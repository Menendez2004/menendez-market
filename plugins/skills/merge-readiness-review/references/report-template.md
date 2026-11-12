# Report Template

Copy this structure exactly. Keep headings in English and in this order so
reviews compare over time; write the prose in the user's language. Save to
`.dev/merge-review/YYYY-MM-DD-<source-slug>-into-<target-slug>.md`.

````markdown
# Merge Readiness Review — <source> → <target>

| | |
|---|---|
| **Date** | YYYY-MM-DD |
| **Mode** | Current branch / Branch / Pull request #<n> |
| **Source** | <ref> @ <sha> |
| **Target** | <remote>/<target> @ <sha> (fetched <time>) |
| **Merge base** | <sha> — target is <n> commits ahead, source is <n> commits ahead |
| **Diff** | <n> files, +<n> −<n> (overlap with target: <n> files) |
| **Stack** | <language, framework, package manager, test runner> |
| **ponytail** | loaded (<name/path>), level <level> / not available / failed to load (<why>) |
| **Method** | Merge simulated in a temporary worktree (`merge --no-commit`); checks run on the target (baseline) and on the merged tree; consumers traced in the merged tree. No branch was changed. |
| **Excluded from the merge** | <uncommitted/untracked changes in Mode A, or "none"> |

## Verdict

**<⛔ Not ready | ⚠️ Ready with conditions | ✅ Ready>**

<2–4 sentences: why, the one thing to do first.>

| Area | Result |
|---|---|
| Textual conflicts | n |
| Semantic conflicts | n |
| Checks | n regressions · n pre-existing · n fixed · n not verified |
| Affected flows | n — n by check · n by reading · n unverified |
| Contracts | n findings |
| Minimalism (ponytail) | n findings / not available |

## Blockers

### B1 [BLOCKER] <title>
- **Location:** `file:line`
- **What happens:** <…>
- **Proof:** <check output / target commit <sha> / call site read>
- **Fix:** <smallest change>

## Conflicts

### Textual
| File | Target side (commit) | Source side | Resolution guidance |
|---|---|---|---|

### Semantic
| # | What the target changed (commit) | What the source relies on | Effect on the merged tree |
|---|---|---|---|

## Checks

| Check | Command | Baseline (<target>@<sha>) | Merged | Class |
|---|---|---|---|---|
| Install | `…` | | | |
| Typecheck | `…` | | | |
| Lint | `…` | | | |
| Build | `…` | | | |
| Tests (area) | `…` | | | |
| Tests (full) | `…` | | | |

<Relevant output lines for each regression.>

## Affected flows

| # | Changed surface | Consumer (`file:line`) | Flow | Status | Notes |
|---|---|---|---|---|---|
| F1 | | | | Verified by check / by reading / Unverified | |

## Contracts

- C1 [SEVERITY] <API / migration / config / event / dependency> — `file:line` — <finding or "checked, compatible">

## Minimalism (ponytail)

<"ponytail not available" or the list:>
- M1 [MEDIUM|LOW] `file:line` — <what is unnecessary> → <simpler alternative, where it already exists>

## Other findings

### H1 [HIGH] …
### L1 [MEDIUM|LOW] …

## Conditions to merge

1. <only for "Ready with conditions": each condition, how to satisfy it>

## Open questions

- <what could not be confirmed and what would settle it>

## Coverage

- **Commands run:** <list, with exit codes>
- **Not run, and why:** <…>
- **Consumers outside the repo (not readable):** <…>
- **Cleanup:** temp worktree removed, refs deleted, user's tree unchanged (<branch>@<sha>)
````
