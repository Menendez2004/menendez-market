---
title: Never change production code to make a test pass
impact: CRITICAL
tags:
  - testing
  - verification
  - bugs
---

## Rule

This skill edits only test files and test helpers (factories, fixtures,
mock setup). When a correct test fails against the current code:

1. Re-read the unit and the test. If the test is wrong, fix the test.
2. If the test is right, the code has a suspected bug. Do **not** edit the
   production code, do **not** weaken or delete the assertion, and do
   **not** mark it `skip` / `xfail` / `@Disabled` / `.only`.
3. Report it under "Suspected bugs" with `file:line`, expected vs actual,
   and the failing test name, and ask the user how to proceed (fix the bug,
   or keep the test failing as a reproduction).

The same applies to code that cannot be isolated: suggest the minimal
refactor (inject the dependency, add a seam) in the report, but do not make
it.

**Incorrect:**

```diff
- expect(applyDiscount(order, code).total).toBe(0);
+ expect(applyDiscount(order, code).total).toBeLessThan(order.total);   // "fixed" the test
```

- Error: Weakened the assertion because the code returns a negative total.

**Correct:**

```
Suspected bugs:
- src/pricing/discount.ts:42 — discount larger than the total returns
  total = -15.00; expected 0 (clamped). Test: "clamps the total to 0 when
  the discount exceeds it". Fix the code, or keep the test as a failing
  reproduction?
```

**Why it matters:** A test rewritten to match broken code documents the bug
as intended behavior, and a production change the user did not ask for is
outside this skill's job.
