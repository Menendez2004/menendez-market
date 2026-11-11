---
title: Recommendations are incremental and proportional
impact: HIGH
tags:
  - reporting
  - refactoring
  - roadmap
---

## Rule

Each recommendation is the **smallest step** that reduces a real cost,
proportional to the size and lifetime of the code:

- Prefer known, safe refactorings (Extract Function/Class, Move Function,
  Introduce Parameter Object, Replace Conditional with Polymorphism,
  Introduce Interface + inject, Inline/delete dead code) and name them.
- When behavior is not covered by tests, the first step is a
  characterization test of the code to refactor; say so.
- Do not recommend new abstractions (interfaces, factories, layers) that
  have one implementation and no testing or boundary reason. KISS and
  YAGNI apply to recommendations too.
- Never recommend a rewrite or a full pattern migration as a first step.
  Bigger moves go under **Strategic**, with the trade-off and the
  incremental path (strangler fig, module by module).

Group the recommendations in the roadmap:

| Group | Effort | Examples |
|---|---|---|
| **Quick wins** | ≤ 1 day, low risk | extract duplicated validator, delete dead code, inject a dependency |
| **Planned refactors** | days, needs tests first | split a god service, move SQL into repositories |
| **Strategic** | needs a team decision | adopt hexagonal for `billing/`, replace a deprecated framework |

Each roadmap item links to the finding IDs it closes.

**Incorrect:**

```markdown
Rewrite the module using Clean Architecture with CQRS and event sourcing.
```

**Correct:**

```markdown
**Quick wins**
1. Extract `validateAddress()` (closes D2) — S.
2. Inject `OrderRepository` into `OrderService` instead of `new` (closes P4) — S.

**Planned refactors**
3. Add characterization tests for `OrderService.checkout`, then extract
   `PricingPolicy` (closes P3, D5) — M.

**Strategic**
4. `billing/` has grown real domain rules; consider hexagonal there only,
   migrating one use case at a time. Trade-off: more files and wiring vs.
   testable rules and swappable payment providers.
```

**Why it matters:** Teams adopt recommendations that fit in a sprint and
ignore the ones that require stopping everything. Small, ordered steps
actually get done.
