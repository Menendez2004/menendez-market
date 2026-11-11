# Technical Debt Catalog

Categories to walk for every review, with what to look for, how to
measure it with read-only commands, and the usual payment. Confirm every
signal by reading the code before reporting it.

## 1. Design and architecture debt

| Smell | How to find it | Usual payment |
|---|---|---|
| Pattern drift (code contradicts the declared pattern) | `pat-conventions` checklist | Move back module by module, or update the docs if the drift is right |
| Wrong dependency direction (domain → infra, cycles) | read imports; `npx madge --circular src`, dependency-cruiser if installed | Invert with an interface; extract shared module |
| God module / shared dumping ground | `debt_scan.py` largest files; `grep -rl "from '.*utils'" \| wc -l` | Split by responsibility, move helpers to their callers |
| Missing boundary between features | deep imports into other features' internals | Public API per feature (index exports) |
| Tight coupling to a vendor/framework | SDK types in business code | Adapter + interface owned by the app |

## 2. Code debt

| Smell | How to find it | Threshold to report |
|---|---|---|
| Long function / method | `debt_scan.py` long functions | > 50 lines, or does more than one thing |
| Large file / class | `debt_scan.py` largest files | > 400 lines with mixed concerns |
| Deep nesting / high complexity | `debt_scan.py` max indent; ESLint `complexity` rule in report mode | nesting > 4 levels; cyclomatic > 10 |
| Long parameter list | read signatures | > 4 params, or boolean flag params |
| Duplication | `debt_scan.py` duplicate blocks; `npx jscpd` if installed | ≥ 6 identical normalized lines in 2+ places |
| Dead code | unused exports (`ts-prune`, `knip`, `vulture` if installed), commented-out code from `debt_scan.py`, unreachable branches | always, after confirming no dynamic use |
| Magic numbers / strings | literals repeated across files | repeated business constants |
| Primitive obsession / data clumps | the same 3+ params passed together; IDs/amounts as raw strings | when it caused or invites a bug |
| Error handling debt | empty `catch {}`, swallowed errors, `catch (e) { console.log(e) }`, generic `throw new Error` | always in business paths |
| Inconsistent conventions | two ways to do the same thing (fetch + axios, callbacks + promises, camel + snake) | when it confuses or duplicates |
| Type debt | `any`, `@ts-ignore`, `# type: ignore`, `as unknown as` | count + hot spots |
| Debt markers | `TODO`, `FIXME`, `HACK`, `XXX` from `debt_scan.py`; age via `git blame` | FIXME/HACK always; TODO older than 6 months |

## 3. Test debt

| Smell | How to find it |
|---|---|
| No tests for business-critical code | `debt_scan.py` "files without a test counterpart"; list the critical ones |
| Low coverage | existing coverage report (`coverage/`, `lcov.info`) if present; do not run the suite just to measure |
| Skipped / disabled tests | `grep -rn "it.skip\|xit(\|describe.skip\|@pytest.mark.skip\|@Disabled"` |
| Brittle tests | tests asserting implementation details, many mocks, snapshot overuse |
| Slow / integration-only tests | business logic testable only with a DB/network (links to DIP) |

## 4. Dependency debt

| Smell | How to find it (read-only) |
|---|---|
| Outdated major versions | `npm outdated`, `pip list --outdated`, `bundle outdated`, `go list -u -m all` (only if they run without credentials) |
| Deprecated / unmaintained packages | deprecation warnings in lockfile/metadata; known-abandoned libraries |
| Known vulnerabilities | `npm audit --omit=dev --json`, `pip-audit` if installed (report counts by severity) |
| Unused dependencies | `npx depcheck`, `knip` if installed; confirm with grep |
| Duplicate libraries for one job | two HTTP clients, two date libraries, two state managers |
| Pinned to a fork or git URL | `package.json`, `requirements.txt` |

## 5. Documentation debt

- README / ARCHITECTURE / ADRs missing, or contradicting the code.
- Public modules or complex algorithms without a one-line explanation.
- Comments that lie (describe old behavior).
- Setup steps that only live in someone's head (no `.env.example`, no
  run instructions).

## 6. Build, config and infrastructure debt

- Hard-coded config, URLs or credentials in code (mask values in the report).
- Manual release/setup steps; no CI or CI without lint/type/test checks.
- Compiler/linter warnings disabled or ignored (`eslint-disable` at file
  level, `skipLibCheck` hiding real errors, `--no-verify` scripts).
- Environment drift (different Node/Python versions across files).

## Measuring interest with git (read-only)

```bash
# Churn: most changed files in the last 6 months (hotspots)
git log --since="6 months ago" --format= --name-only -- <scope> | sort | uniq -c | sort -rn | head -20

# Bug-fix pressure on a file
git log --since="12 months ago" --oneline -i --grep="fix\|bug\|hotfix" -- <file> | wc -l

# Age of a debt marker
git blame -L <line>,<line> --date=short <file>

# Files that change together (hidden coupling)
git log --format="--%h" --name-only -- <scope> | awk '/^--/{n++} !/^--/ && NF{print}' | sort | uniq -c | sort -rn | head
```

## Fowler's technical debt quadrant

| | Reckless | Prudent |
|---|---|---|
| **Deliberate** | "No time for design" | "Ship now, and deal with the consequences" |
| **Inadvertent** | "What's layering?" | "Now we know how we should have done it" |

Use it to label debt when the history makes it clear (commit messages,
TODOs, ADRs). It guides the conversation, not the priority.
