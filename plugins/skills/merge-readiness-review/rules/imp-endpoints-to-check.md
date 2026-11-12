---
title: Suggest the existing endpoints to check, with what and how
impact: HIGH
tags:
  - impact
  - endpoints
  - api
  - regression
---

## Rule

When the repo exposes HTTP/RPC endpoints, the report always includes
**Endpoints to check**: the endpoints of flows that already exist and
that the incoming change can affect, so the user (or QA) knows exactly
what to exercise before or after merging.

1. **Find candidates** with `scripts/endpoint_impact.py --tree <merged worktree> --base <merge-base> --source <source-sha>`.
   It walks the reverse import graph from the changed files to the route
   files (JS/TS with tsconfig aliases, Python; symbol-name fallback for
   other languages) and diffs the routes of changed route files.
2. **Add what imports cannot see**: handlers that read/write a table or
   column the change touches (search the repositories/models that use it,
   then their handlers), consumers of a changed event/job, endpoints
   behind a changed feature flag or config key, handlers resolved through
   DI by string, GraphQL resolvers and RPC methods.
3. **Prioritize**:
   - **P1** — route removed or its method/path changed (existing clients
     break); handler edited directly; or a confirmed incompatible
     behavior change on its path.
   - **P2** — the handler uses the changed code within 1–2 hops.
   - **P3** — farther away, or the file imports the module but the
     handler does not reference the changed symbol.
   - **GLOBAL** — app-wide middleware, guards, interceptors, bootstrap,
     settings or the router root changed: smoke-test one public and one
     authenticated endpoint per router/module.
   - New endpoints added by the source are listed apart: they are not
     existing flows.
4. **Confirm before listing**: read each chain; drop false positives
   (and say so in Coverage). Never list an endpoint only because the
   script printed it.
5. For each endpoint kept, write: method and **full path** (resolve
   mounts, controller prefixes, global prefix, API version), `file:line`
   of the route, the **existing flow** it serves, **why** it is affected
   (the chain down to the changed `file:line`), **what to check** given
   this change (the field, status code, permission, side effect or
   performance that could differ, with the expected value), a
   **ready-to-run request** (curl or the repo's HTTP client format, with
   placeholders, never real tokens or data), and whether a **test that
   passed on the merged tree** already covers it.
6. P1 endpoints with no covering test and no confirmed-compatible call
   site are at least **HIGH** findings (`rules/rpt-evidence-verdict.md`).

**Incorrect:**

```markdown
Endpoints to check: the orders API and maybe users.
```

**Correct:**

```markdown
| E2 | P2 | `GET /api/v1/orders/:id` | `src/routes/orders.ts:4` | order detail (customer app, admin) |
  `routes/orders.ts:4` ← `services/orders.ts:2 getOrder` ← `utils/money.ts:1 calcTotal` (now adds 16% tax) |
  `total` of an order with items [100, 50] must be 174, not 150; invoice PDF uses the same total |
  `tests/orders.spec.ts:30` ✓ (checks shape only, not the amount → also run the request) |
```

**Why it matters:** The diff names files; people test endpoints. A short,
prioritized list of the existing endpoints the change reaches, with the
exact request and the expected result, is what turns "probably fine"
into a check someone actually runs.
