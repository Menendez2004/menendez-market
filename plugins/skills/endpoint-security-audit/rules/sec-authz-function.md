---
title: Function-level authorization (BFLA / privileged routes)
impact: CRITICAL
tags:
  - security
  - authorization
  - bfla
  - owasp-api5
---

## Rule

Identify every privileged action — admin panels, refunds, role changes,
user management, feature flags, exports of all records, impersonation,
internal/debug routes — and confirm a role or permission check is enforced
server-side on that route, not just authentication.

Check:

- Route under `/admin`, `/internal`, `/manage` or with verbs like refund,
  approve, ban, promote, export, impersonate guarded only by `requireAuth`.
- Role check that trusts a client value (`req.body.role`, `req.headers['x-admin']`,
  a JWT claim the user could have set at signup).
- A role check on the router that one route escapes (registered on `app`
  instead of the admin router, or before `router.use(requireAdmin)`).
- Different HTTP methods on the same path with different guards
  (GET admin-only, DELETE not).
- Frontend-only hiding of admin buttons is not authorization.

**Incorrect:**

```js
// routes/admin.js:5
router.post('/admin/refund', requireAuth, refundController.issue);
```

- Error: Any authenticated customer can issue refunds.

**Correct:**

```js
router.post('/admin/refund', requireAuth, requireRole('admin'), refundController.issue);
```

**Why it matters:** BFLA turns an ordinary account into an administrator
(OWASP API5:2023, CWE-285, CWE-862). In money flows it is direct financial
loss.
