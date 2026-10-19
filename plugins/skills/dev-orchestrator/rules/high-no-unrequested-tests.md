---
title: Never create unit tests unless the Lead asks for tests
impact: HIGH
tags: [tests, scope, planner, task-agent]
---

**Incorrect (Lead asks: "add rate limiting to the login endpoint"):**

```
The Planner adds step 4, "Write unit tests for the rate limiter". Or, with
no such step, the Task Agent for step 2 also creates
tests/rate-limit.test.ts "to cover the new code".
```

The Lead asked for rate limiting, not tests. The test file is code nobody
requested, someone has to review and maintain it, and nobody runs it here
anyway (`rules/high-checks-not-tests.md`).

**Correct (same request):**

```
The plan has no test step, and no Task Agent creates or edits test files.
If step 2's change will clearly break an existing test, the Task Agent
leaves the test alone and says so in "Notes for next steps"; the
Orchestrator tells the Lead in the final report.

Had the Lead said "add rate limiting with unit tests", the Planner would
include a test step and its Task Agent would write them.
```

**Rules:**

- Unit tests (and any other new test files) are created only when the Lead
  asks for tests: in the request, in the Lead's plan, or in a later
  decision recorded in `.dev/tasks/_decisions.md`.
- The Planner adds no test step unless the Lead asked for tests. It does
  not list "add tests?" as an open question either.
- A Task Agent creates or edits test files only when its step says so.
  Existing tests that its change breaks are reported in its result, not
  fixed.
- In single-session mode the Orchestrator follows the same rule.

**Why it matters:** Unrequested tests are unrequested code: they grow the
diff, cost review time, and can lock in behavior the Lead has not agreed
to. Whether a change needs tests, and which, is the Lead's call.
