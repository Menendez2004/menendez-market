---
title: Never run tests; run checks once, after the whole task is complete
impact: HIGH
tags: [checks, tests, verification]
---

**Incorrect (Task Agent finishes step 2 of 4):**

```
The Task Agent implements rate limiting, runs `npm test`, waits for the full
suite, then runs `npm run lint` and `tsc --noEmit`, and only then writes its
result file. The Task Agent for step 3 does the same, and so does step 4.
```

The test suite ran three times on half-finished work, and checks ran on
intermediate states that later steps changed anyway.

**Correct (same plan):**

```
Each Task Agent implements its step (including writing test files if the
step asks for them), does NOT run tests or checks, and writes its result
file. After step 4 completes, the Orchestrator runs the checks once:

  npm run lint       -> ok
  npm run typecheck  -> 1 error in src/limits.ts:18
  npm run build      -> ok

It records the results in .dev/orchestrator.md under "Final Checks" and
reports the typecheck error, with its output, to the Lead, asking how to
proceed.
```

**What counts as a check:** fast, static verification using the project's
own tooling: lint, format check, typecheck, build/compile, and the project's
own validators (for example `claude plugin validate .`). Discover them from
the project (package.json scripts, Makefile, pyproject, CI config); do not
invent commands.

**What does not:** any test runner or test suite (unit, integration, e2e,
snapshot), such as `npm test`, `pytest`, `go test`, `jest`, `vitest`,
`playwright`, including "just one test". If the Lead explicitly asks for a
test run, that is the Lead's decision for that task only.

**Rules:**

- No agent in this skill runs tests. Writing or editing test files when a
  plan step asks for it is allowed.
- Checks run once, by the Orchestrator, after every plan step is complete.
  Task Agents and Research Sub-agents never run them.
- Failing checks are reported to the Lead with their output. The Orchestrator
  does not start a fix-and-recheck loop on its own.

**Why it matters:** Tests are slow and belong to the Lead's or CI's
verification, not to every agent step. Running checks per step verifies
states that later steps overwrite; running them once on the finished task
gives the Lead one clear, current signal.
