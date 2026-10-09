---
title: Every endpoint fully specified
impact: CRITICAL
tags:
  - handoff
  - api-contract
  - completeness
---

## Rule

Each `## Endpoint N` block must answer, in its fixed subsections:

| Subsection | Must contain |
|---|---|
| `### Purpose` | what it does, why the receiver needs it, which screen/flow uses it |
| `### Request` | table with method, full path, auth (role/scope), idempotency, rate limit |
| `#### Path parameters` | name, type, meaning — or `None.` |
| `#### Query parameters` | name, type, required, default, rules — or `None.` |
| `#### Headers` | headers beyond Conventions (e.g. `Idempotency-Key`) — or `None.` |
| `#### Body` | field table + JSON example (`ep-body-table-and-example.md`) — or `No body.` |
| `#### Success` | status code, field table with nullability, JSON example |
| `#### Errors` | every error status (`ep-error-contract.md`) |
| `### Behavior and side effects` | writes, events, emails, jobs, transactions, caching — or `None — read only.` |
| `### Receiver notes` | frontend: where it is called, UI states, types · backend: validation, authorization, data model, where it fits |
| `### Acceptance criteria` | testable criteria (`ep-acceptance-criteria.md`) |

Types are precise: `string (uuid)`, `string (datetime)`, `integer`,
`number`, `boolean`, `enum` (list every value), `array`, `object`,
`string | null`. Nullable and optional are different things; state both.

**Incorrect:**

```markdown
### Request
POST to orders with the cart.
```

**Correct:** see Endpoint 1 in
`references/examples/backend-to-frontend.handoff.md`.

**Why it matters:** Each missing item is a question the receiver must ask
or a guess they will make. A complete block lets them work alone.
