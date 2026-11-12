---
title: Trace the blast radius — every flow the change touches
impact: CRITICAL
tags:
  - impact
  - callers
  - regression
---

## Rule

1. From the incoming diff, list every **changed surface**: exported
   functions/classes/methods (signature *or* behavior), component props,
   hooks, routes/handlers, queries, tables/columns, events/messages,
   config keys, env vars, feature flags, shared constants, types, CSS
   classes used elsewhere, scripts, dependencies.
2. For each one, find **all consumers in the merged tree** (search the
   merged worktree or `git grep <name> <target-sha>` plus the source's own
   additions), using `references/impact-checklist.md` for how to search
   each kind (re-exports, dynamic access, string routes, other packages of
   a monorepo, other apps/services in the repo, templates, SQL, jobs, tests).
3. For each consumer, write the **flow** it belongs to (e.g. "checkout →
   apply coupon → order total") and its status:
   - **Verified by check** — name the test that exercises it and passed merged;
   - **Verified by reading** — the call site at `file:line` is compatible with the new behavior; say why;
   - **Unverified** — say what would confirm it (a test, a manual step, a team to ask).
4. Behavior changes count as much as signature changes: a function that
   now throws instead of returning `null`, sorts differently, returns a
   string instead of a number, or takes longer, affects every caller.
5. Consumers outside the repo (other services, mobile apps, public API
   clients) cannot be read: list them as Unverified with the contract change.

**Incorrect:**

```markdown
Impact: only `coupons/` changed, low risk.
```

**Correct:**

```markdown
| # | Changed surface | Consumer | Flow | Status |
|---|---|---|---|---|
| F1 | `getUser()` now returns `null` instead of throwing (`users/repo.ts:31`) | `auth/session.ts:54` | login | Verified by reading — checks `if (!user)` |
| F2 | same | `admin/impersonate.ts:20` (exists only on main) | admin impersonation | Unverified — dereferences `.id` without a check; no test |
| F3 | `GET /orders` `total` → string | `admin-web/src/orders/table.tsx:41` | admin orders table | Unverified — does `a.total + b.total` |
```

**Why it matters:** The diff shows what changed, not who depends on it.
The flows that break after a merge are almost always outside the diff.
