---
title: When the code drifts, identify the actual pattern with evidence
impact: HIGH
tags:
  - pattern
  - detection
  - architecture
---

## Rule

When the verdict is not **Follows**, or no expected pattern was found,
name the pattern the code **actually** implements, using the detection
signals in `references/pattern-catalog.md`. Include anti-patterns: they
are patterns too (big ball of mud, god object, anemic domain model,
transaction script, fat controller, service locator, spaghetti
callbacks, golden hammer).

The section must contain:

1. **Actual pattern:** a precise name, qualified if needed
   ("layered, but the domain depends on the ORM").
2. **Evidence:** 2–5 `file:line` references that show it.
3. **Deliberate or accidental:** deliberate if it is consistent across the
   scope and plausibly chosen (a simple CRUD app using transaction
   scripts on purpose); accidental if it is inconsistent, contradicts the
   declared pattern, or grew by copy-paste.
4. **Fit:** whether the actual pattern fits the code's needs. A
   transaction script is fine for a 5-endpoint CRUD; it is debt for a
   pricing engine with 40 rules.
5. **Direction:** either *"move back to the expected pattern"* (with the
   first steps) or *"keep the actual pattern and document it"* (when it
   fits better), with the trade-off in one or two sentences.

A scope may mix patterns (a clean `use-cases/` folder and a muddy
`utils/`). Report per folder in that case.

**Incorrect:**

```markdown
The code does not follow hexagonal architecture. Consider refactoring.
```

**Correct:**

```markdown
**Actual pattern:** Layered (controller → service → TypeORM repository) with
an ORM-coupled domain — accidental drift.
**Evidence:** `domain/Order.ts:1` imports `typeorm` decorators;
`application/OrderService.ts:12` does `new PostgresOrderRepository()`;
no `ports/` folder exists; adapters call services directly.
**Fit:** The domain has real rules (`Order.applyCoupon`, `Order.cancel`),
so the hexagonal isolation the README promises is worth keeping.
**Direction:** Move back: first extract `OrderRepository` as a port in
`domain/`, inject it, then move TypeORM mappings into `infrastructure/`.
```

**Why it matters:** "It doesn't follow the pattern" is not actionable.
Naming what the code really is tells the team what they have, whether it
is a problem, and which way to move.
