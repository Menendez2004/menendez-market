---
title: Required case matrix per unit
impact: HIGH
tags:
  - testing
  - coverage
  - edge-cases
---

## Rule

Build the case list from the unit's contract and branches, then cover every
row that applies. Any row you skip goes under "Not covered" in the report
with the reason.

| Category | What to cover |
|---|---|
| Happy path | The main successful behavior, with typical factory data |
| Branches | Each `if` / `switch` arm, early return and loop with 0, 1 and many items |
| Invalid input | Wrong type, missing required field, malformed value, `null`/`undefined`/`None` where the type allows it |
| Boundaries | Min, max, just inside and just outside every limit; empty string/collection |
| Errors | Every error the unit throws, and every collaborator failure it must handle (rejected promise, exception, timeout) |
| Side effects | Collaborator calls that are part of the contract (saved, published, sent) with their arguments — and that they do **not** happen on failure paths |

Coverage is a check, not a goal: aim to execute every branch of the unit,
but never add a test that asserts nothing to raise the number.

**Incorrect:** a suite for `applyDiscount(order, code)` with only
"applies a 10% discount".

**Correct:** happy path; expired code; unknown code; code below the order's
minimum total; total exactly at the minimum; empty order; discount larger
than the total (clamped to 0); repository failure while loading the code;
`order.save` not called when the code is rejected.

**Why it matters:** Bugs live at boundaries and in error paths, which are
exactly the cases a happy-path-only suite never runs.
