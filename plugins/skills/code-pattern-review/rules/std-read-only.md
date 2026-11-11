---
title: Read-only review; the report goes to .dev/pattern-review/
impact: CRITICAL
tags:
  - review
  - scope
  - safety
---

## Rule

A review reads code, configuration, docs and git history. It does not
edit application code, tests or config, and it does not run commands that
change the repo.

- Allowed: reading files, `grep`, `git log`/`git diff`/`git blame`,
  running `scripts/debt_scan.py`, and read-only analysis tools the repo
  already has (`npx tsc --noEmit`, the linter in report mode,
  `npm outdated`, `pip list --outdated`, a dependency-cruiser or
  import-linter check) when they need no network credentials.
- Not allowed: `--fix` flags, formatters, installing or upgrading
  dependencies, refactoring "while you are there", writing anywhere other
  than the report file.
- The report always goes to `.dev/pattern-review/YYYY-MM-DD-<scope-slug>.md`
  relative to the project root. Create `.dev/pattern-review/` if it does
  not exist. Do not commit it.
- Recommendations are applied only when the user asks after the review,
  one at a time, keeping behavior identical.

**Incorrect:**

```bash
npx eslint src/orders --fix
mkdir -p docs/reviews && cat > docs/reviews/orders.md
```

- Error: Changes code during a review, and saves the report outside its folder.

**Correct:**

```bash
npx eslint src/orders --format json > /dev/null   # read results only
mkdir -p .dev/pattern-review
# write .dev/pattern-review/2026-11-11-src-orders.md with the Write tool
```

**Why it matters:** The user asked for a diagnosis, not surgery. Edits
mixed into a review are unreviewed changes, and reports scattered across
the repo get committed by accident. One folder per skill under `.dev/`
keeps every review in a known place, out of the codebase.
