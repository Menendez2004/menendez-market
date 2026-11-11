---
title: Open/Closed Principle (OCP)
impact: MEDIUM
tags:
  - solid
  - ocp
  - extensibility
---

## Rule

Code should be **open to extension and closed to modification**: adding
a new variant of a known concept should not require editing working
code in several places.

Signals to check:

- `switch`/`if-else` chains on a type, kind or status string that are
  repeated in several places (`grep` the discriminator).
- `git log` shows the same function edited every time a new variant
  (payment method, shipping type, report format) was added.
- Flags or boolean parameters that select behavior (`render(x, true, false)`).

Report only **known, recurring** axes of change. One `switch` over a
closed enum that never grows is not a violation; do not recommend
abstracting things "in case" they change.

**Incorrect (code under review):**

```ts
function shippingCost(kind: string, kg: number) {
  if (kind === "standard") return kg * 1;
  if (kind === "express") return kg * 2;
  if (kind === "same-day") return kg * 4 + 10; // added last month
}
// same chain repeated in eta() and label()
```

**Correct (recommended shape):**

```ts
interface ShippingMethod { cost(kg: number): number; eta(): Days; label(): string }
const methods: Record<ShippingKind, ShippingMethod> = { standard, express, sameDay };
```

**Why it matters:** Each new variant edits N places, and forgetting one
is a bug. A strategy or a lookup table makes a new variant one new unit.
