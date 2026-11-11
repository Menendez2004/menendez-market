#!/usr/bin/env python3
"""Scan a file or folder for technical-debt signals, with file:line.

Usage:
  python3 debt_scan.py [<file-or-dir>] [--json] [--include-tests]
                       [--top N] [--long-fn N] [--dup-lines N]

Reports:
  - largest files (lines of code, excluding blank lines)
  - longest functions (heuristic, per language family)
  - deepest nesting (max indentation level per file)
  - debt markers: TODO, FIXME, HACK, XXX, @ts-ignore, eslint-disable,
    type: ignore, noqa, `any` casts
  - commented-out code blocks (3+ consecutive comment lines that look like code)
  - duplicated blocks (N+ identical normalized lines in 2+ places)
  - source files without a test counterpart

These are signals, not findings: the reviewer must open each location and
confirm it before reporting. Standard library only. Exit code 0 always.
"""

import argparse
import json
import os
import re
import signal
import sys
from collections import defaultdict

SKIP_DIRS = {
    ".git", "node_modules", "vendor", "dist", "build", "out", ".next", ".nuxt",
    "coverage", "__pycache__", ".venv", "venv", "env", "target", ".gradle",
    ".idea", ".vscode", "bower_components", ".turbo", ".cache", "site-packages",
    ".dev", ".pytest_cache", ".mypy_cache", "bin", "obj", "Pods",
}
TEST_HINTS = re.compile(
    r"(^|/)(tests?|__tests__|spec|specs|e2e|fixtures?|mocks?|__mocks__)(/|$)"
    r"|[._-](test|spec)\.\w+$|(^|/)test_[^/]+\.py$|_test\.(go|py)$|Tests?\.(java|kt|cs)$"
)
GENERATED_HINTS = re.compile(r"\.(min|bundle|generated|gen|pb)\.\w+$|\.d\.ts$|(^|/)migrations?/")
EXTS = {
    ".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".jsx", ".tsx", ".vue", ".svelte",
    ".py", ".rb", ".go", ".java", ".kt", ".kts", ".scala", ".php", ".cs", ".swift",
    ".rs", ".c", ".h", ".cpp", ".hpp", ".cc", ".dart",
}
BRACE_LANGS = EXTS - {".py", ".rb"}
MAX_BYTES = 1_500_000

MARKERS = [
    ("FIXME", re.compile(r"\bFIXME\b")),
    ("HACK", re.compile(r"\bHACK\b")),
    ("XXX", re.compile(r"\bXXX\b")),
    ("TODO", re.compile(r"\bTODO\b")),
    ("ts-ignore", re.compile(r"@ts-(ignore|nocheck|expect-error)")),
    ("eslint-disable", re.compile(r"eslint-disable(?!-next-line\s+\S*no-console)")),
    ("type-ignore", re.compile(r"#\s*type:\s*ignore|#\s*noqa|#\s*pylint:\s*disable")),
    ("any-cast", re.compile(r":\s*any\b|\bas\s+any\b|as\s+unknown\s+as\b")),
    ("empty-catch", re.compile(r"catch\s*(\([^)]*\))?\s*\{\s*\}|except[^:]*:\s*pass\b")),
]

COMMENT_LINE = re.compile(r"^\s*(//|#|\*|/\*)")
CODE_LIKE = re.compile(
    r"(;\s*$|\)\s*\{?\s*$|^\s*(//|#)\s*(if|for|while|return|const|let|var|def|class|import|from|function|await|print)\b|=\s*[\w\"'\[{(])"
)

FN_START = {
    "brace": re.compile(
        r"^\s*(export\s+)?(default\s+)?(public|private|protected|static|async|override|final|internal|\s)*"
        r"(function\b|func\b|fn\b|def\b|[\w<>\[\],?\s]+\s+\w+\s*\([^;]*\)\s*(\{|=>|throws|:)"
        r"|(const|let|var)\s+\w+\s*=\s*(async\s*)?(\([^)]*\)|\w+)\s*=>|\w+\s*\([^;]*\)\s*\{)"
    ),
    "py": re.compile(r"^(\s*)(async\s+)?def\s+(\w+)"),
    "rb": re.compile(r"^(\s*)def\s+([\w.?!]+)"),
}
FN_NAME = re.compile(r"(?:function\s+|func\s+|fn\s+|def\s+)?(\w+)\s*(?:=\s*(?:async\s*)?\(|\(|=\s*(?:async\s*)?\w+\s*=>)")
KEYWORDS = {"if", "for", "while", "switch", "catch", "return", "else", "do", "try", "with", "elif", "new"}


def is_test(rel):
    return bool(TEST_HINTS.search(rel))


def walk(root, include_tests):
    if os.path.isfile(root):
        yield root, os.path.basename(root)
        return
    for d, dirs, files in os.walk(root):
        dirs[:] = sorted(x for x in dirs if x not in SKIP_DIRS and not x.startswith("."))
        for f in sorted(files):
            p = os.path.join(d, f)
            rel = os.path.relpath(p, root)
            if os.path.splitext(f)[1] not in EXTS or GENERATED_HINTS.search(rel):
                continue
            if not include_tests and is_test(rel):
                continue
            try:
                if os.path.getsize(p) > MAX_BYTES:
                    continue
            except OSError:
                continue
            yield p, rel


def read(p):
    try:
        with open(p, encoding="utf-8", errors="replace") as fh:
            return fh.read().splitlines()
    except OSError:
        return []


def indent_of(line):
    expanded = line.expandtabs(4)
    return len(expanded) - len(expanded.lstrip(" "))


def detect_indent_unit(lines):
    steps = [indent_of(l) for l in lines if l.strip() and indent_of(l) > 0]
    if not steps:
        return 4
    unit = min(steps)
    return unit if 2 <= unit <= 8 else 4


def functions_brace(lines):
    """Track brace depth from each function-looking line until it closes."""
    out = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if FN_START["brace"].match(line) and not COMMENT_LINE.match(line):
            m = FN_NAME.search(line)
            name = m.group(1) if m else "?"
            if name in KEYWORDS:
                i += 1
                continue
            depth = 0
            opened = False
            j = i
            while j < n and j < i + 2000:
                code = re.sub(r"(['\"`])(?:\\.|(?!\1).)*\1", "", lines[j])
                code = code.split("//")[0]
                depth += code.count("{") - code.count("}")
                if "{" in code:
                    opened = True
                if opened and depth <= 0:
                    break
                if not opened and j > i + 3:
                    break
                j += 1
            if opened:
                out.append((name, i + 1, j - i + 1))
                i += 1
                continue
        i += 1
    return out


def functions_indent(lines, pattern):
    out = []
    for i, line in enumerate(lines):
        m = pattern.match(line)
        if not m:
            continue
        base = len(m.group(1).expandtabs(4))
        name = m.groups()[-1]
        end = i
        for j in range(i + 1, len(lines)):
            s = lines[j]
            if not s.strip():
                continue
            if indent_of(s) <= base and not s.strip().startswith((")", "]", "}")):
                if pattern is FN_START["rb"] and s.strip() == "end":
                    end = j
                break
            end = j
        out.append((name, i + 1, end - i + 1))
    return out


def normalize(line):
    s = line.strip()
    if not s or COMMENT_LINE.match(s) or s in {"{", "}", "};", ")", "});", "]", "end", "else", "} else {"}:
        return None
    if re.match(r"^(import|from|using|package|#include|require\(|use )\b", s):
        return None
    return re.sub(r"\s+", " ", s)


def scan(root, include_tests, top, long_fn, dup_lines):
    files = {}
    markers = []
    commented = []
    long_functions = []
    nesting = []
    windows = defaultdict(list)
    sources = []
    all_rels = set()

    for p, rel in walk(root, True):
        all_rels.add(rel)
    for p, rel in walk(root, include_tests):
        lines = read(p)
        if not lines:
            continue
        ext = os.path.splitext(p)[1]
        loc = sum(1 for l in lines if l.strip())
        files[rel] = loc
        if not is_test(rel):
            sources.append(rel)

        for i, line in enumerate(lines, 1):
            for tag, rx in MARKERS:
                if rx.search(line):
                    markers.append({"tag": tag, "file": rel, "line": i, "text": line.strip()[:140]})
                    break

        run = []
        for i, line in enumerate(lines, 1):
            if COMMENT_LINE.match(line) and CODE_LIKE.search(line):
                run.append(i)
            else:
                if len(run) >= 3:
                    commented.append({"file": rel, "line": run[0], "lines": len(run)})
                run = []
        if len(run) >= 3:
            commented.append({"file": rel, "line": run[0], "lines": len(run)})

        unit = detect_indent_unit(lines)
        deepest = max(((indent_of(l) // unit, i) for i, l in enumerate(lines, 1) if l.strip()), default=(0, 0))
        nesting.append({"file": rel, "line": deepest[1], "depth": deepest[0]})

        if ext == ".py":
            fns = functions_indent(lines, FN_START["py"])
        elif ext == ".rb":
            fns = functions_indent(lines, FN_START["rb"])
        else:
            fns = functions_brace(lines)
        for name, start, length in fns:
            if length >= long_fn:
                long_functions.append({"file": rel, "line": start, "name": name, "lines": length})

        norm = [(normalize(l), i) for i, l in enumerate(lines, 1)]
        norm = [(t, i) for t, i in norm if t]
        for k in range(len(norm) - dup_lines + 1):
            chunk = norm[k:k + dup_lines]
            key = "\n".join(t for t, _ in chunk)
            if len(key) < dup_lines * 12:
                continue
            windows[key].append((rel, chunk[0][1], chunk[-1][1]))

    duplicates = []
    seen = set()
    for key, locs in windows.items():
        uniq = []
        for loc in locs:
            if not any(loc[0] == u[0] and abs(loc[1] - u[1]) < dup_lines for u in uniq):
                uniq.append(loc)
        if len(uniq) < 2:
            continue
        sig = tuple(sorted((f, a // dup_lines) for f, a, _ in uniq))
        if sig in seen:
            continue
        seen.add(sig)
        duplicates.append({
            "occurrences": [{"file": f, "start": a, "end": b} for f, a, b in uniq],
            "first_line": key.split("\n")[0][:120],
        })
    # Merge overlapping windows: keep one block per first occurrence region
    merged = []
    for d in sorted(duplicates, key=lambda d: (d["occurrences"][0]["file"], d["occurrences"][0]["start"])):
        o = d["occurrences"][0]
        if merged:
            p = merged[-1]["occurrences"][0]
            if p["file"] == o["file"] and o["start"] <= p["end"] + 1 and len(d["occurrences"]) == len(merged[-1]["occurrences"]):
                for a, b in zip(merged[-1]["occurrences"], d["occurrences"]):
                    a["end"] = max(a["end"], b["end"])
                continue
        merged.append(d)

    untested = []
    test_names = {re.sub(r"(\.|_|-)(test|spec)$|^test_|_test$|Tests?$", "", os.path.splitext(os.path.basename(r))[0]).lower()
                  for r in all_rels if is_test(r)}
    for rel in sources:
        stem = os.path.splitext(os.path.basename(rel))[0].lower()
        if stem in {"index", "main", "__init__", "types", "constants", "config"}:
            continue
        if stem not in test_names:
            untested.append(rel)

    marker_counts = defaultdict(int)
    for m in markers:
        marker_counts[m["tag"]] += 1

    return {
        "root": root,
        "files_scanned": len(files),
        "total_loc": sum(files.values()),
        "largest_files": sorted(({"file": f, "loc": n} for f, n in files.items()), key=lambda x: -x["loc"])[:top],
        "long_functions": sorted(long_functions, key=lambda x: -x["lines"])[:top],
        "deepest_nesting": sorted(nesting, key=lambda x: -x["depth"])[:top],
        "marker_counts": dict(sorted(marker_counts.items(), key=lambda kv: -kv[1])),
        "markers": markers,
        "commented_out_code": sorted(commented, key=lambda x: -x["lines"])[:top],
        "duplicate_blocks": sorted(merged, key=lambda d: -(len(d["occurrences"]) * (d["occurrences"][0]["end"] - d["occurrences"][0]["start"] + 1)))[:top],
        "untested_sources": untested if test_names else [],
        "no_tests_found": not test_names,
    }


def print_text(r, top):
    print(f"# Debt scan: {r['root']}")
    print(f"files scanned: {r['files_scanned']}   non-blank lines: {r['total_loc']}")
    print("(signals only: open every location and confirm before reporting)\n")

    print(f"## Largest files (top {top})")
    for x in r["largest_files"]:
        print(f"  {x['loc']:>6}  {x['file']}")

    print("\n## Longest functions")
    if not r["long_functions"]:
        print("  none above threshold")
    for x in r["long_functions"]:
        print(f"  {x['lines']:>6}  {x['file']}:{x['line']}  {x['name']}")

    print("\n## Deepest nesting (indent levels)")
    for x in r["deepest_nesting"]:
        if x["depth"] >= 4:
            print(f"  {x['depth']:>6}  {x['file']}:{x['line']}")

    print("\n## Debt markers")
    if not r["markers"]:
        print("  none")
    else:
        print("  " + ", ".join(f"{k}: {v}" for k, v in r["marker_counts"].items()))
        for m in r["markers"][: top * 3]:
            print(f"  [{m['tag']}] {m['file']}:{m['line']}  {m['text']}")
        if len(r["markers"]) > top * 3:
            print(f"  ... {len(r['markers']) - top * 3} more (use --json)")

    print("\n## Commented-out code blocks")
    if not r["commented_out_code"]:
        print("  none")
    for x in r["commented_out_code"]:
        print(f"  {x['lines']:>3} lines  {x['file']}:{x['line']}")

    print("\n## Duplicated blocks")
    if not r["duplicate_blocks"]:
        print("  none")
    for n, d in enumerate(r["duplicate_blocks"], 1):
        locs = ", ".join(f"{o['file']}:{o['start']}-{o['end']}" for o in d["occurrences"])
        print(f"  #{n} x{len(d['occurrences'])}: {locs}")
        print(f"      starts: {d['first_line']}")

    print("\n## Source files without a test counterpart")
    if r["no_tests_found"]:
        print("  no test files found in scope")
    elif not r["untested_sources"]:
        print("  none")
    else:
        for f in r["untested_sources"][: top * 2]:
            print(f"  {f}")
        if len(r["untested_sources"]) > top * 2:
            print(f"  ... {len(r['untested_sources']) - top * 2} more (use --json)")


def main(argv):
    ap = argparse.ArgumentParser(description="Scan a file or folder for technical-debt signals.")
    ap.add_argument("path", nargs="?", default=".")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--include-tests", action="store_true")
    ap.add_argument("--top", type=int, default=15)
    ap.add_argument("--long-fn", type=int, default=50, help="min lines to flag a function")
    ap.add_argument("--dup-lines", type=int, default=6, help="min identical lines for a duplicate block")
    a = ap.parse_args(argv)
    if not os.path.exists(a.path):
        print(f"path not found: {a.path}", file=sys.stderr)
        return 0
    r = scan(a.path, a.include_tests, a.top, a.long_fn, a.dup_lines)
    if a.json:
        json.dump(r, sys.stdout, indent=2)
        print()
    else:
        print_text(r, a.top)
    return 0


if __name__ == "__main__":
    if hasattr(signal, "SIGPIPE"):
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)
    sys.exit(main(sys.argv[1:]))
