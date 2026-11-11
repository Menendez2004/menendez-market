---
title: Every finding has evidence, impact and a fix
impact: CRITICAL
tags:
  - reporting
  - evidence
  - false-positives
---

## Rule

A pattern violation, SOLID finding or debt item is reported only when all
of these are written down:

1. **Location:** every relevant `file:line` (or line range). For a
   repeated problem, the count plus the most representative locations.
2. **What the code does:** one or two sentences describing the actual
   behavior, quoting a short snippet when it makes the point.
3. **Which rule it breaks:** the convention ID (`C2`), the SOLID principle,
   or the debt category.
4. **Impact here:** the concrete cost in this codebase (a bug, a test that
   cannot be written, a change that touches N files), not a textbook
   consequence.
5. **Fix:** the smallest change, as a short sketch in the repo's own
   language and style.

Report a root cause once and list every location, rather than one finding
per file. Things you suspect but cannot confirm from the code go under
**Open questions** with what would settle them.

**Incorrect:**

```markdown
### [MEDIUM] Violates SRP
The service has too many responsibilities.
```

**Correct:**

```markdown
### P3 [HIGH] OrderService mixes pricing, persistence and email (SRP)
- **Location:** `services/OrderService.ts:14-210`
- **What it does:** computes discounts (`:40-96`), writes with raw Knex
  (`:120-150`) and sends confirmation emails via `nodemailer` (`:170-205`).
- **Breaks:** SRP; convention C1 (services delegate persistence to repositories).
- **Impact here:** 9 of the last 20 commits touch this file for unrelated
  features; its test file mocks 6 modules and has 3 skipped tests.
- **Fix:** extract `PricingPolicy` and `OrderMailer`; move queries into
  `OrderRepository` (exists for reads at `repositories/OrderRepository.ts`).
```

**Why it matters:** Developers act on what they can see and verify. A
vague finding costs them an investigation and costs the review its
credibility.
