---
title: Run the checks on the baseline and on the merged tree; classify each failure
impact: CRITICAL
tags:
  - checks
  - tests
  - regression
---

## Rule

1. Use the repo's own commands: CI config first (`.github/workflows`,
   `.gitlab-ci.yml`, ...), then package scripts / Makefile / pyproject /
   go / cargo. `merge_probe.py` lists what it detects. Never invent a
   command the repo does not use.
2. In the temp worktree, on the **target SHA**: install (frozen lockfile:
   `npm ci`, `pnpm i --frozen-lockfile`, `yarn --immutable`,
   `pip install -r` / `uv sync --frozen`, `go mod download`...) and run
   typecheck, lint (report mode), build, tests. This is the **baseline**.
3. Merge the source with `--no-commit`. Re-install only if a manifest or
   lockfile changed. Run **the same** commands. This is the **merged run**.
4. Tests: at least the tests of the changed area and of every consumer
   found by `imp-blast-radius`; the full suite when feasible.
5. Classify every failing check/test: **Regression** (pass → fail),
   **Pre-existing** (fail → fail, same failure), **Fixed** (fail → pass),
   **Not verified** (could not run; give the reason). Flaky suspicion:
   re-run that one test once on each side before deciding.
6. Record exact commands, exit codes and the relevant lines of output.

**Incorrect:**

```markdown
Tests: 3 failures → Not ready.
```

- Error: Two of the three also fail on `main` without the change.

**Correct:**

```markdown
| Check | Baseline (main@9f1e2d0) | Merged | Class |
|---|---|---|---|
| `npm run typecheck` | ✓ | ✗ TS2305 `coupons/apply.ts:22` | Regression |
| `npm test` | 410/412 (2 fail: `mailer.spec.ts`) | 409/412 | 1 Regression (`cart.spec.ts:88`), 2 Pre-existing |
| `npm run e2e` | not run | not run | Not verified — needs Postgres + Stripe keys |
```

**Why it matters:** Without a baseline, every red test is blamed on the
incoming code, and real regressions hide among old failures.
