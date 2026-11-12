#!/usr/bin/env python3
"""Suggest the existing endpoints to check, given what a merge changes.

Usage:
  python3 endpoint_impact.py --base <sha> --source <sha> [--tree <dir>]
                             [--depth N] [--json]

  --base    merge base of target and source (merge_probe.py prints it)
  --source  the incoming commit
  --tree    directory to analyze: the merged temp worktree (default: repo root)
  --depth   max import hops from a changed file to a route file (default 4)

How:
  1. Takes the files and lines the source changed since the base, and the
     symbols defined or edited in those hunks.
  2. Lists route definitions in --tree (vendored list_routes.py).
  3. Builds a reverse import graph (JS/TS incl. tsconfig paths, Python)
     and walks from each changed file up to the route files that depend
     on it; for other languages, falls back to searching the changed
     symbols in route files.
  4. Compares the routes in the base and source versions of changed route
     files to find endpoints that were removed or re-pathed.

Output, by priority:
  P1  endpoint removed/renamed, or its handler edited directly
  P2  route file imports changed code (1-2 hops) and uses a changed symbol
  P3  further away, or only the module is imported / symbol name matches
  GLOBAL  app-wide files changed (middleware, app bootstrap, settings):
          smoke-test representative endpoints of every module
  NEW endpoints added by the source (not existing flows, listed apart)

These are candidates from static heuristics: confirm each chain by reading
it before putting it in the report. Read-only. Standard library only.
Exit code 0 always, 2 on error.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict, deque

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import list_routes as lr  # noqa: E402

JS_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]
CODE_EXTS = set(lr.EXTS)
GLOBAL_HINTS = re.compile(
    r"(^|/)(middlewares?|interceptors?|guards?|filters?|pipes?|plugins?)/"
    r"|(^|/)(app|main|server|index|bootstrap|asgi|wsgi|urls|routes|router)\.(ts|js|mjs|cjs|py)$"
    r"|(^|/)settings[^/]*\.py$|(^|/)(app\.module|main)\.ts$|(^|/)middleware\.(ts|js)$", re.I)
DEF_RX = [
    re.compile(r"\b(?:function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)"),
    re.compile(r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]"),
    re.compile(r"^\s*(?:export\s+)?(?:public|private|protected|static|async|\s)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^={]+)?\{"),
    re.compile(r"\b(?:def|class)\s+([A-Za-z_]\w*)"),
    re.compile(r"\bfunc\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)"),
    re.compile(r"\b(?:public|private|protected|internal)\s+[\w<>\[\],\s]+?\s+([A-Za-z_]\w*)\s*\("),
]
SKIP_SYMBOLS = {"if", "for", "while", "switch", "catch", "return", "function", "constructor",
                "get", "set", "post", "put", "patch", "delete", "main", "init", "self", "this",
                "data", "value", "result", "error", "props", "state", "test", "describe", "it"}


def git(cwd, *args):
    p = subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {p.stderr.strip()}")
    return p.stdout


def show(cwd, sha, path):
    p = subprocess.run(["git", "-C", cwd, "show", f"{sha}:{path}"], capture_output=True, text=True)
    return p.stdout if p.returncode == 0 else None


def symbols_in(text):
    out = set()
    for rx in DEF_RX:
        for m in rx.finditer(text):
            name = m.group(1)
            if len(name) >= 3 and name.lower() not in SKIP_SYMBOLS:
                out.add(name)
    return out


def changed(cwd, base, source):
    """{path: {"status", "old_path", "new_lines": [(a,b)], "old_lines": [(a,b)], "symbols": set}}"""
    files = {}
    for line in git(cwd, "diff", "--name-status", "-M", base, source).splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            files[parts[-1]] = {"status": parts[0][0], "old_path": parts[1] if len(parts) == 3 else parts[-1],
                                "new_lines": [], "old_lines": [], "symbols": set()}
    cur = None
    for line in git(cwd, "diff", "-U0", "-M", base, source).splitlines():
        if line.startswith("+++ "):
            path = line[4:]
            cur = files.get(path[2:]) if path.startswith("b/") else None
        elif line.startswith("--- "):
            continue
        elif line.startswith("@@") and cur is not None:
            m = re.match(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)", line)
            if m:
                o, oc, n, nc = int(m.group(1)), int(m.group(2) or 1), int(m.group(3)), int(m.group(4) or 1)
                if oc:
                    cur["old_lines"].append((o, o + oc - 1))
                if nc:
                    cur["new_lines"].append((n, n + nc - 1))
                cur["symbols"] |= symbols_in(m.group(5))
        elif cur is not None and line[:1] in "+-":
            cur["symbols"] |= symbols_in(line[1:])
    return files


def scan_routes_text(rel, text):
    ext = os.path.splitext(rel)[1].lower()
    rows = []
    for fw, rx in lr.FILE_ROUTES:
        fm = rx.search(rel)
        if fm:
            rows.append({"method": "FILE", "path": "/" + fm.group(2), "framework": fw, "location": f"{rel}:1", "line": 1})
    for i, line in enumerate(text.splitlines(), 1):
        for r in lr.scan_line(rel, ext, i, line):
            r["line"] = i
            rows.append(r)
    return rows


def walk_tree(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in lr.SKIP_DIRS and not d.startswith("."))
        for name in sorted(filenames):
            if os.path.splitext(name)[1].lower() in CODE_EXTS:
                full = os.path.join(dirpath, name)
                rel = os.path.relpath(full, root).replace(os.sep, "/")
                if lr.TEST_HINTS.search(rel):
                    continue
                try:
                    if os.path.getsize(full) <= lr.MAX_BYTES:
                        with open(full, encoding="utf-8", errors="replace") as fh:
                            yield rel, fh.read()
                except OSError:
                    continue


def load_ts_paths(root):
    aliases = []
    for name in ("tsconfig.json", "jsconfig.json", "tsconfig.base.json"):
        p = os.path.join(root, name)
        if not os.path.isfile(p):
            continue
        raw = open(p, encoding="utf-8", errors="replace").read()
        raw = re.sub(r"/\*.*?\*/", "", raw, flags=re.S)
        raw = re.sub(r"(?m)^\s*//.*$", "", raw)
        raw = re.sub(r",(\s*[}\]])", r"\1", raw)
        try:
            co = json.loads(raw).get("compilerOptions", {})
        except ValueError:
            continue
        base = co.get("baseUrl", ".")
        for alias, targets in (co.get("paths") or {}).items():
            for t in targets:
                aliases.append((alias.rstrip("*"), os.path.normpath(os.path.join(base, t.rstrip("*"))).replace(os.sep, "/")))
    return aliases


JS_IMPORT = re.compile(r"""(?:\bimport\s[^'"`]*?from\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bexport\s[^'"`]*?from\s*|^\s*import\s+)['"`]([^'"`]+)['"`]""", re.M)
PY_IMPORT = re.compile(r"^\s*(?:from\s+(\.*[\w.]*)\s+import\s+([\w*, ()]+)|import\s+([\w.]+))", re.M)


def resolve_js(spec, importer, files, aliases):
    cands = []
    if spec.startswith("."):
        cands.append(os.path.normpath(os.path.join(os.path.dirname(importer), spec)).replace(os.sep, "/"))
    else:
        for alias, target in aliases:
            if alias and spec.startswith(alias):
                cands.append(os.path.normpath(os.path.join(target, spec[len(alias):])).replace(os.sep, "/").lstrip("./"))
    for c in cands:
        stem = re.sub(r"\.(js|mjs|cjs)$", "", c)
        for opt in [c, *(stem + e for e in JS_EXTS), *(c + "/index" + e for e in JS_EXTS)]:
            if opt in files:
                return opt
    return None


def build_graph(texts, root):
    """reverse graph: file -> set(importers), plus imported names per edge."""
    files = set(texts)
    aliases = load_ts_paths(root)
    py_mods = {}
    for f in files:
        if f.endswith(".py"):
            mod = f[:-3].replace("/", ".")
            mod = mod[:-9] if mod.endswith(".__init__") else mod
            parts = mod.split(".")
            for i in range(len(parts)):
                py_mods.setdefault(".".join(parts[i:]), f)
    rev = defaultdict(set)
    names = defaultdict(set)  # (imported_file, importer) -> names
    for f, text in texts.items():
        if f.endswith(".py"):
            pkg = f.rsplit("/", 1)[0].replace("/", ".") if "/" in f else ""
            for m in PY_IMPORT.finditer(text):
                mod, what = (m.group(1), m.group(2)) if m.group(1) is not None else (m.group(3), "")
                if mod.startswith("."):
                    dots = len(mod) - len(mod.lstrip("."))
                    base = pkg.split(".")[: max(0, len(pkg.split(".")) - (dots - 1))] if pkg else []
                    mod = ".".join([*base, mod.lstrip(".")]).strip(".")
                imported = [w.strip(" ()") for w in what.split(",") if w.strip(" ()")]
                targets = [py_mods.get(mod)] + [py_mods.get(f"{mod}.{w}") for w in imported]
                for t in filter(None, targets):
                    if t != f:
                        rev[t].add(f)
                        names[(t, f)].update(imported)
        elif os.path.splitext(f)[1] in JS_EXTS:
            for m in JS_IMPORT.finditer(text):
                t = resolve_js(m.group(1), f, files, aliases)
                if t and t != f:
                    rev[t].add(f)
                    head = text[max(0, m.start() - 300): m.end()]
                    br = re.findall(r"\{([^}]*)\}\s*from\s*['\"`]" + re.escape(m.group(1)), head)
                    for grp in br:
                        names[(t, f)].update(x.split(" as ")[0].strip() for x in grp.split(",") if x.strip())
    return rev, names


def route_key(r):
    return (r["method"], r["path"])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", required=True)
    ap.add_argument("--source", required=True)
    ap.add_argument("--tree", default=None)
    ap.add_argument("--depth", type=int, default=4)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    try:
        root = os.path.abspath(a.tree or git(".", "rev-parse", "--show-toplevel").strip())
        ch = changed(root, a.base, a.source)
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

    texts = dict(walk_tree(root))
    routes_by_file = defaultdict(list)
    for f, text in texts.items():
        for r in scan_routes_text(f, text):
            routes_by_file[f].append(r)
    rev, names = build_graph(texts, root)
    all_symbols = set().union(*(c["symbols"] for c in ch.values())) if ch else set()

    suggestions = {}  # (location) -> dict

    def add(route, prio, why, confidence, symbols=()):
        if route["method"] in {"MOUNT", "PREFIX"}:
            return
        k = route["location"]
        cur = suggestions.get(k)
        rank = {"P1": 1, "P2": 2, "P3": 3}
        if cur and rank[cur["priority"]] <= rank[prio]:
            if why not in cur["why"]:
                cur["why"].append(why)
            cur["changed_symbols"] = sorted(set(cur["changed_symbols"]) | set(symbols))
            return
        symbols = set(symbols) | set(cur["changed_symbols"] if cur else ())
        suggestions[k] = {"priority": prio, "method": route["method"], "path": route["path"],
                          "location": route["location"], "framework": route["framework"],
                          "why": [why] + (cur["why"] if cur else []), "confidence": confidence,
                          "changed_symbols": sorted(symbols)}

    removed, new = [], []
    for path, c in ch.items():
        if not path.endswith(tuple(CODE_EXTS)) or lr.TEST_HINTS.search(path):
            continue
        old_text = show(root, a.base, c["old_path"]) if c["status"] != "A" else ""
        src_text = show(root, a.source, path) if c["status"] != "D" else ""
        old_routes = scan_routes_text(c["old_path"], old_text or "")
        src_routes = scan_routes_text(path, src_text or "")
        old_keys, src_keys = {route_key(r) for r in old_routes}, {route_key(r) for r in src_routes}
        for r in old_routes:
            if route_key(r) not in src_keys and r["method"] not in {"MOUNT", "PREFIX"}:
                removed.append({**r, "location": f"{c['old_path']}:{r['line']} (base)"})
        for r in src_routes:
            if route_key(r) not in old_keys and r["method"] not in {"MOUNT", "PREFIX"}:
                new.append(r)
        # handler edited directly: a changed line falls between this route's line and the next route's
        lines = sorted({r["line"] for r in src_routes})
        hit_keys = set()
        for a_, b_ in c["new_lines"]:
            for i, ln in enumerate(lines):
                nxt = lines[i + 1] if i + 1 < len(lines) else 10 ** 9
                if ln <= b_ and a_ < nxt:
                    hit_keys |= {route_key(r) for r in src_routes if r["line"] == ln}
        for r in routes_by_file.get(path, []):
            if route_key(r) in old_keys:
                if route_key(r) in hit_keys:
                    add(r, "P1", "handler edited directly in this diff", "high", c["symbols"])
                else:
                    add(r, "P2", "route file edited (other part of the file)", "medium", c["symbols"])

    # walk the reverse import graph from each changed file to route files
    def segments(f):
        """route line -> handler text (from the route line to the next route line)"""
        lines = texts.get(f, "").splitlines()
        starts = sorted({r["line"] for r in routes_by_file[f]})
        return {ln: "\n".join(lines[ln - 1:(starts[i + 1] - 1 if i + 1 < len(starts) else len(lines))])
                for i, ln in enumerate(starts)}

    for path, c in ch.items():
        if path not in texts:
            continue
        # node -> (hops, chain, changed symbols reaching it, names imported from the previous node)
        seen = {path: (0, [path], set(c["symbols"]), set())}
        q = deque([path])
        while q:
            f = q.popleft()
            d, chain, carried, _ = seen[f]
            if d >= a.depth:
                continue
            for imp in rev.get(f, ()):
                if imp in seen:
                    continue
                imported = names.get((f, imp), set())
                text = texts.get(imp, "")
                hit = {s for s in carried if re.search(rf"\b{re.escape(s)}\b", text)} if d == 0 else set(carried)
                if d == 0 and imported and not (imported & c["symbols"]) and not hit:
                    hit = set()  # imports the module but none of the changed symbols
                seen[imp] = (d + 1, chain + [imp], hit, imported)
                q.append(imp)
                if imp not in routes_by_file or imp == path:
                    continue
                hops = d + 1
                why = f"{' <- '.join(reversed(chain + [imp]))} ({hops} hop{'s' if hops > 1 else ''})"
                segs = segments(imp)
                refs = imported | hit
                for r in routes_by_file[imp]:
                    body = segs.get(r["line"], "")
                    in_handler = bool(refs) and any(re.search(rf"\b{re.escape(x)}\b", body) for x in refs)
                    if hit and in_handler and hops <= 2:
                        add(r, "P2", why, "high" if hops == 1 else "medium", hit)
                    elif hit and in_handler:
                        add(r, "P3", why, "medium", hit)
                    else:
                        add(r, "P3", why + " — handler does not reference the changed code directly", "low")

    # fallback for languages without import resolution: symbol search in route files
    graph_langs = (".py", *JS_EXTS)
    for path, c in ch.items():
        if path.endswith(graph_langs) or not c["symbols"]:
            continue
        for f, rows in routes_by_file.items():
            if f == path:
                continue
            used = {s for s in c["symbols"] if re.search(rf"\b{re.escape(s)}\b", texts.get(f, ""))}
            if used:
                for r in rows:
                    add(r, "P3", f"uses symbol(s) changed in {path} (name match only)", "low", used)

    new_keys = {(r["location"].rsplit(":", 1)[0], route_key(r)) for r in new}
    for k in [k for k, v in suggestions.items() if (k.rsplit(":", 1)[0], (v["method"], v["path"])) in new_keys]:
        del suggestions[k]

    global_files = sorted(p for p in ch if GLOBAL_HINTS.search(p))
    order = {"P1": 0, "P2": 1, "P3": 2}
    sug = sorted(suggestions.values(), key=lambda s: (order[s["priority"]], s["location"]))
    result = {"tree": root, "base": a.base, "source": a.source,
              "changed_files": len(ch), "changed_symbols": sorted(all_symbols),
              "routes_in_tree": sum(len(v) for v in routes_by_file.values()),
              "removed_or_repathed": removed, "suggested": sug,
              "global_changes": global_files, "new_endpoints": new}

    if a.json:
        print(json.dumps(result, indent=2, default=list))
        return 0
    print(f"# Endpoints to check — {a.base[:10]}..{a.source[:10]} in {root}\n")
    print(f"{len(ch)} changed files, {result['routes_in_tree']} route rows in tree, "
          f"{len(all_symbols)} changed symbols. Candidates only: read each chain before reporting.\n")
    if removed:
        print("## P1 — Removed or re-pathed endpoints (clients of the old route break)")
        for r in removed:
            print(f"  - {r['method']} `{r['path']}` — was at {r['location']}")
        print()
    print("## Existing endpoints that may be affected")
    if not sug:
        print("  none found via imports/symbols (check dynamic wiring, DI, events, DB-shared flows by hand)")
    else:
        print("| Prio | Method | Path | Route at | Why | Confidence | Changed symbols used |")
        print("| --- | --- | --- | --- | --- | --- | --- |")
        for s in sug:
            print(f"| {s['priority']} | {s['method']} | `{s['path']}` | {s['location']} | {'; '.join(s['why'][:2])} "
                  f"| {s['confidence']} | {', '.join(s['changed_symbols'][:6]) or '-'} |")
    if global_files:
        print("\n## GLOBAL — app-wide files changed: smoke-test one endpoint per module/router")
        for p in global_files:
            print(f"  - {p}")
    if new:
        print("\n## New endpoints added by the source (not existing flows)")
        for r in new:
            print(f"  - {r['method']} `{r['path']}` — {r['location']}")
    print("\nNote: MOUNT/PREFIX rows are not listed; resolve full paths by reading the router mounts.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
