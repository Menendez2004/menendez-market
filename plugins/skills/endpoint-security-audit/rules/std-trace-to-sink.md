---
title: Trace each input from the request to its sink, across files
impact: CRITICAL
tags:
  - audit
  - data-flow
  - taint
---

## Rule

For every route, enumerate its sources and follow each one through the
handler and every function it calls, across files, until it reaches a sink
or a check that neutralizes it. A route is not reviewed until its called
functions are read.

**Sources:** path params, query string, body fields, headers (including
`Host`, `X-Forwarded-*`), cookies, uploaded file names and contents, and
records loaded with an ID from the request (their fields are only as
trustworthy as the authorization on that load).

**Sinks:** see `references/sinks.md` — queries, shell, filesystem,
outbound HTTP, templates/HTML, `eval`/deserialization, redirects, model
writes, money/stock updates, and the response itself (exposure).

**Neutralizers:** parameterized queries, allowlists, schema validation that
actually runs before the sink (check it is wired in, and what it strips or
coerces), ownership checks, `path.resolve` + base-dir check. A regex or
`replace('../', '')` is not a neutralizer until you show it cannot be
bypassed.

**Incorrect:**

```text
POST /api/refunds → refundController.create → calls refundService.issue(req.body)
"Service probably validates the amount." ✓ reviewed
```

- Error: Stopped at the call boundary and guessed.

**Correct:**

```text
POST /api/refunds (routes/refunds.js:9) → refundController.create (controllers/refund.js:12)
  → refundService.issue(orderId, amount) (services/refund.js:20)
      loads order by orderId with no owner filter (services/refund.js:22)  ← BOLA
      amount from body, never compared to order.total (services/refund.js:25) ← logic flaw
      payments.refund(order.chargeId, amount) (services/refund.js:31)  ← money sink
```

**Why it matters:** Handlers are usually thin. The flaws live in services,
repositories and helpers that several routes share — which is also why one
bug there affects many endpoints.
