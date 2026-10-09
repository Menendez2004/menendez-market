---
title: Implementer follows the contract exactly; mismatches are reported
impact: CRITICAL
tags:
  - handoff
  - implementation
  - contract
---

## Rule

When implementing a handoff (Mode C):

- Validate it first. Do not start on `status: draft` if an open question
  blocks your side; ask instead. Non-blocking questions: implement the
  rest and list them in your report.
- Use the exact method, full path, field names, casing, types,
  nullability, headers and status codes in the handoff. Do not rename,
  "improve" or reshape anything.
- Implement every row of `#### Errors` as its `Receiver must` column says.
- Map every acceptance criterion to the code or test that satisfies it,
  and report each by id (`AC-1.3 met — CheckoutForm.test.tsx`).
- Follow the receiving codebase's own conventions for *how* (API client,
  data-fetching library, DTO style, error handling), never for *what* the
  contract says.
- If the handoff is wrong or contradicts the code you can see (the real
  endpoint returns `quantity` as a string, a field is missing, the path
  404s), do not adapt silently: list it under **Contract mismatches** with
  file:line or the observed response, and ask which side changes.
- Do not edit the handoff file yourself unless asked; a revision belongs
  to its author (Mode D).

**Incorrect:**

```typescript
// handoff says items[].quantity; the backend team "probably" accepts qty
api.post("/orders", { items: cart.map(l => ({ id: l.id, qty: l.n })) });
```

**Correct:**

```typescript
api.post<Order>("/api/v1/orders", {
  items: cart.map(l => ({ productId: l.id, quantity: l.n })),
  shippingAddress,
}, { headers: { "Idempotency-Key": idempotencyKey } });
```

**Why it matters:** The handoff is the only thing both sides agreed on.
Every silent deviation becomes an integration bug found late.
