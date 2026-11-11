---
title: Identify technical debt by category, with evidence
impact: HIGH
tags:
  - technical-debt
  - code-smells
  - maintainability
---

## Rule

Walk every category in `references/tech-debt-catalog.md` for the code in
scope and record each debt item with:

1. **ID and category:** `D3 · Code — duplication`.
2. **Evidence:** `file:line` (all occurrences, or the count plus the top
   three).
3. **Interest:** what it costs **today** in this repo — bugs it has
   caused or invites, changes it slows down, onboarding it confuses. Use
   facts when available: `git log` churn, bug-fix commits touching it,
   TODO age from `git blame`.
4. **Principal:** the effort to pay it — S (≤ 1 h), M (≤ 1 day),
   L (days), XL (needs planning).
5. **Kind** (Fowler's quadrant), when it is clear: deliberate/prudent
   ("we shipped fast, will clean up"), deliberate/reckless, inadvertent.

Categories to cover: design & architecture, code (smells, complexity,
duplication, dead code, magic values, error handling), tests (missing,
brittle, slow, untested critical paths), dependencies (outdated,
deprecated, vulnerable, unused, duplicated), documentation (missing,
stale, contradicts code), build & config (manual steps, hard-coded
config, no CI checks, warnings ignored).

Use `scripts/debt_scan.py` for signals, then **read the code**: a long
file may be a generated fixture, a TODO may be a ticket reference that
is fine. Unconfirmed scanner rows never reach the report.

**Incorrect:**

```markdown
- The code has some duplication and could use more tests.
```

**Correct:**

```markdown
### D2 · Code — duplication
- **Evidence:** the same 22-line address validation in
  `controllers/user.js:20-41`, `controllers/checkout.js:58-79`,
  `services/shipping.js:11-32` (scanner block #4).
- **Interest:** the `zip` rule was fixed only in `user.js` (commit a41c9e2,
  "fix zip validation"); checkout still accepts 4-digit zips.
- **Principal:** S — extract `validateAddress()` into `validators/address.js`.
- **Kind:** inadvertent.
```

**Why it matters:** Debt that is not located and costed cannot be
planned. "More tests" never gets scheduled; "D2 caused bug a41c9e2, one
hour to fix" does.
