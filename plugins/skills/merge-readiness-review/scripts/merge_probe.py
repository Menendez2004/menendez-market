#!/usr/bin/env python3
"""Probe a merge of <source> into <target> without touching the working tree.

Usage:
  python3 merge_probe.py --target <branch> [--source <ref>] [--pr <n>]
                         [--remote origin] [--no-fetch] [--json]

Reports:
  - target / source / merge-base SHAs, and how far each side moved
  - files changed on each side since the merge base, and their overlap
  - textual conflicts (git merge-tree --write-tree, git >= 2.38)
  - risk signals per changed file (migrations, lockfiles, manifests,
    env/config, routes, schemas, CI, public entry points)
  - check commands detected in the repo at the target (package scripts,
    Makefile, pyproject, go, cargo, CI `run:` steps)
  - uncommitted changes when the source is HEAD (they are NOT merged)

Only fetches and reads: no checkout, merge, commit or push. With --pr it
creates refs/merge-review/pr-<n>; delete it when done. Standard library
only. Exit code: 0 clean, 1 textual conflicts, 2 error.
"""

import argparse
import json
import re
import subprocess
import sys

RISK_RULES = [
    ("migration", re.compile(r"(^|/)(migrations?|migrate|alembic/versions|db/migrate|prisma/migrations)/|\.sql$", re.I)),
    ("lockfile", re.compile(r"(^|/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|poetry\.lock|uv\.lock|Pipfile\.lock|Gemfile\.lock|composer\.lock|Cargo\.lock|go\.sum)$")),
    ("manifest", re.compile(r"(^|/)(package\.json|pyproject\.toml|requirements[^/]*\.txt|setup\.(py|cfg)|Pipfile|Gemfile|composer\.json|Cargo\.toml|go\.mod|pom\.xml|build\.gradle(\.kts)?)$")),
    ("env/config", re.compile(r"(^|/)(\.env[^/]*|config/|settings[^/]*\.py$|[^/]*\.config\.(js|ts|mjs|cjs)$|application[^/]*\.(ya?ml|properties)$|docker-compose[^/]*\.ya?ml$|Dockerfile[^/]*$|helm/|k8s/|terraform/|[^/]*\.tf$)", re.I)),
    ("route/api", re.compile(r"(^|/)(routes?|controllers?|handlers?|endpoints?|api|resolvers?|views)(/|\.)", re.I)),
    ("schema/contract", re.compile(r"\.(proto|graphql|gql|avsc)$|(^|/)(openapi|swagger)[^/]*\.(ya?ml|json)$|(^|/)schema\.prisma$|(^|/)(schemas?|dto|contracts?)/", re.I)),
    ("ci", re.compile(r"(^|/)(\.github/workflows/|\.gitlab-ci\.yml$|\.circleci/|Jenkinsfile$|azure-pipelines\.ya?ml$|bitbucket-pipelines\.yml$)")),
    ("public-entry", re.compile(r"(^|/)(index\.(ts|tsx|js|mjs)|__init__\.py|mod\.rs|lib\.rs)$")),
    ("model/entity", re.compile(r"(^|/)(models?|entities|entity|domain)/", re.I)),
]
CHECK_SCRIPT_HINTS = re.compile(r"^(typecheck|type-check|tsc|check|lint|build|test|tests|test:\w+|e2e|verify|ci)$", re.I)


def git(*args, check=True):
    p = subprocess.run(["git", *args], capture_output=True, text=True)
    if check and p.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed ({p.returncode}): {p.stderr.strip()}")
    return p


def out(*args):
    return git(*args).stdout.strip()


def ref_exists(ref):
    return git("rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}", check=False).returncode == 0


def git_version():
    m = re.search(r"(\d+)\.(\d+)", out("--version"))
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)


def name_status(a, b):
    files = []
    for line in out("diff", "--name-status", "-M", a, b).splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            files.append({"status": parts[0][0], "path": parts[-1], "old_path": parts[1] if len(parts) == 3 else None})
    return files


def risks(path):
    return [name for name, rx in RISK_RULES if rx.search(path)]


def show(sha, path):
    p = git("show", f"{sha}:{path}", check=False)
    return p.stdout if p.returncode == 0 else None


def detect_checks(sha):
    checks = []
    tree = set(out("ls-tree", "-r", "--name-only", sha).splitlines())
    pm = "npm"
    for lock, name in (("pnpm-lock.yaml", "pnpm"), ("yarn.lock", "yarn"), ("bun.lockb", "bun"), ("bun.lock", "bun")):
        if lock in tree:
            pm = name
    pkg = show(sha, "package.json")
    if pkg:
        try:
            scripts = json.loads(pkg).get("scripts", {}) or {}
        except ValueError:
            scripts = {}
        install = {"npm": "npm ci", "pnpm": "pnpm install --frozen-lockfile", "yarn": "yarn install --immutable", "bun": "bun install --frozen-lockfile"}[pm]
        checks.append({"source": "package.json", "kind": "install", "command": install})
        for name in scripts:
            if CHECK_SCRIPT_HINTS.match(name):
                checks.append({"source": "package.json", "kind": name, "command": f"{pm} run {name}"})
    mk = show(sha, "Makefile")
    if mk:
        for target in re.findall(r"^([A-Za-z0-9_.-]+):", mk, re.M):
            if CHECK_SCRIPT_HINTS.match(target):
                checks.append({"source": "Makefile", "kind": target, "command": f"make {target}"})
    py = show(sha, "pyproject.toml")
    if py:
        for tool, cmd in (("pytest", "pytest"), ("ruff", "ruff check ."), ("mypy", "mypy ."), ("pyright", "pyright")):
            if re.search(rf"\[tool\.{tool}", py) or re.search(rf"\b{tool}\b", py):
                checks.append({"source": "pyproject.toml", "kind": tool, "command": cmd})
    if "go.mod" in tree:
        checks += [{"source": "go.mod", "kind": k, "command": c} for k, c in (("build", "go build ./..."), ("vet", "go vet ./..."), ("test", "go test ./..."))]
    if "Cargo.toml" in tree:
        checks += [{"source": "Cargo.toml", "kind": k, "command": c} for k, c in (("build", "cargo build"), ("test", "cargo test"))]
    for path in sorted(tree):
        if re.match(r"\.github/workflows/[^/]+\.ya?ml$", path) or path == ".gitlab-ci.yml":
            text = show(sha, path) or ""
            for m in re.finditer(r"^\s*(?:-\s*)?run:\s*(?:\|\s*\n((?:\s{6,}.+\n?)+)|(.+))$", text, re.M):
                body = (m.group(1) or m.group(2) or "").strip()
                for cmd in body.splitlines():
                    cmd = cmd.strip()
                    if cmd and not cmd.startswith("#"):
                        checks.append({"source": path, "kind": "ci", "command": cmd})
    return checks


def textual_conflicts(target, source):
    if git_version() < (2, 38):
        return None, "git < 2.38: merge-tree --write-tree unavailable; detect conflicts in the temp worktree"
    p = git("merge-tree", "--write-tree", "--name-only", "--no-messages", target, source, check=False)
    if p.returncode == 0:
        return [], None
    if p.returncode == 1:
        lines = [l for l in p.stdout.splitlines()[1:] if l.strip()]
        return sorted(set(lines)), None
    return None, f"merge-tree failed: {p.stderr.strip()}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--target", required=True, help="target branch name (e.g. main, develop)")
    ap.add_argument("--source", default="HEAD", help="source ref (branch or sha); default HEAD")
    ap.add_argument("--pr", type=int, help="fetch pull/<n>/head as the source")
    ap.add_argument("--remote", default="origin")
    ap.add_argument("--no-fetch", action="store_true", help="do not fetch (target may be stale)")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    try:
        root = out("rev-parse", "--show-toplevel")
        warnings = []
        has_remote = a.remote in out("remote").split()
        fetched = False
        if not a.no_fetch and has_remote:
            git("fetch", "--quiet", a.remote, a.target)
            fetched = True
            if a.pr:
                git("fetch", "--quiet", a.remote, f"+pull/{a.pr}/head:refs/merge-review/pr-{a.pr}")
            elif a.source != "HEAD" and not re.fullmatch(r"[0-9a-f]{7,40}", a.source):
                src_branch = a.source.split(f"{a.remote}/", 1)[-1]
                if git("fetch", "--quiet", a.remote, src_branch, check=False).returncode != 0:
                    warnings.append(f"could not fetch source '{src_branch}' from {a.remote}; using local ref")
        elif not a.no_fetch:
            warnings.append(f"remote '{a.remote}' not found: target NOT fetched, may be stale")
        else:
            warnings.append("--no-fetch: target NOT fetched, may be stale")

        target_ref = f"{a.remote}/{a.target}" if ref_exists(f"{a.remote}/{a.target}") else a.target
        if not ref_exists(target_ref):
            raise RuntimeError(f"target '{a.target}' not found (tried {a.remote}/{a.target} and {a.target})")
        if a.pr:
            source_ref = f"refs/merge-review/pr-{a.pr}"
        elif a.source != "HEAD" and ref_exists(f"{a.remote}/{a.source}") and fetched:
            source_ref = f"{a.remote}/{a.source}"
        else:
            source_ref = a.source
        if not ref_exists(source_ref):
            raise RuntimeError(f"source '{source_ref}' not found")

        tsha, ssha = out("rev-parse", target_ref), out("rev-parse", source_ref)
        mb = git("merge-base", tsha, ssha, check=False)
        if mb.returncode != 0:
            raise RuntimeError("no merge base: the branches share no history")
        base = mb.stdout.strip()
        behind, ahead = (int(x) for x in out("rev-list", "--left-right", "--count", f"{tsha}...{ssha}").split())

        src_files = name_status(base, ssha)
        tgt_files = name_status(base, tsha)
        tgt_paths = {f["path"] for f in tgt_files} | {f["old_path"] for f in tgt_files if f["old_path"]}
        for f in src_files:
            f["risks"] = risks(f["path"])
            f["overlap"] = f["path"] in tgt_paths or (f["old_path"] in tgt_paths if f["old_path"] else False)
        stat = out("diff", "--shortstat", base, ssha)

        conflicts, conflict_note = textual_conflicts(tsha, ssha)
        if conflict_note:
            warnings.append(conflict_note)

        dirty = []
        if a.source == "HEAD" and not a.pr:
            dirty = [l for l in out("status", "--porcelain").splitlines() if l.strip()]
            if dirty:
                warnings.append(f"{len(dirty)} uncommitted/untracked paths are NOT part of the merge")

        result = {
            "root": root,
            "fetched": fetched,
            "target": {"ref": target_ref, "sha": tsha, "commits_since_base": behind},
            "source": {"ref": source_ref, "sha": ssha, "commits_since_base": ahead},
            "merge_base": base,
            "already_merged": ahead == 0,
            "source_diffstat": stat,
            "source_files": src_files,
            "target_files_since_base": [f["path"] for f in tgt_files],
            "overlap": sorted(f["path"] for f in src_files if f["overlap"]),
            "textual_conflicts": conflicts,
            "risk_summary": {r: sorted(f["path"] for f in src_files if r in f["risks"]) for r, _ in RISK_RULES if any(r in f["risks"] for f in src_files)},
            "checks_detected_at_target": detect_checks(tsha),
            "uncommitted": dirty,
            "warnings": warnings,
        }
    except RuntimeError as e:
        print(json.dumps({"error": str(e)}) if a.json else f"ERROR: {e}", file=sys.stderr)
        return 2

    if a.json:
        print(json.dumps(result, indent=2))
    else:
        r = result
        print(f"# Merge probe: {r['source']['ref']} -> {r['target']['ref']}\n")
        print(f"- target  {r['target']['sha'][:10]}  (+{r['target']['commits_since_base']} commits since base){'' if r['fetched'] else '  [NOT FETCHED]'}")
        print(f"- source  {r['source']['sha'][:10]}  (+{r['source']['commits_since_base']} commits since base)")
        print(f"- base    {r['merge_base'][:10]}")
        print(f"- diff    {r['source_diffstat'] or 'no changes'}")
        if r["already_merged"]:
            print("- NOTE: source has no commits that the target lacks (nothing to merge)")
        if r["textual_conflicts"] is None:
            print("- textual conflicts: unknown (see warnings)")
        else:
            print(f"- textual conflicts: {len(r['textual_conflicts'])}")
            for p in r["textual_conflicts"]:
                print(f"    ! {p}")
        print(f"\n## Source files ({len(r['source_files'])})")
        for f in r["source_files"]:
            tags = ", ".join(f["risks"] + (["OVERLAP"] if f["overlap"] else []))
            ren = f" (from {f['old_path']})" if f["old_path"] else ""
            print(f"  {f['status']} {f['path']}{ren}{'  [' + tags + ']' if tags else ''}")
        print(f"\n## Overlap with target since base ({len(r['overlap'])})")
        for p in r["overlap"]:
            print(f"  {p}")
        print(f"\n## Target changed since base: {len(r['target_files_since_base'])} files")
        if r["risk_summary"]:
            print("\n## Risk signals")
            for k, v in r["risk_summary"].items():
                print(f"  {k}: {len(v)} — {', '.join(v[:8])}{' …' if len(v) > 8 else ''}")
        print("\n## Check commands detected at target")
        for c in r["checks_detected_at_target"] or [{"source": "-", "kind": "-", "command": "none detected: read CI config / README"}]:
            print(f"  [{c['source']}] {c['kind']}: {c['command']}")
        if r["warnings"]:
            print("\n## Warnings")
            for w in r["warnings"]:
                print(f"  - {w}")
    return 1 if result["textual_conflicts"] else 0


if __name__ == "__main__":
    sys.exit(main())
