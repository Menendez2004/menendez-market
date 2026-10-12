---
title: Rate limits and resource consumption
impact: MEDIUM
tags:
  - security
  - rate-limit
  - dos
  - owasp-api4
---

## Rule

Identify routes an attacker benefits from calling many times or with huge
inputs, and check for a limit enforced in code, middleware or a gateway
config in the repo.

Priority routes:

- login, signup, password reset, OTP / 2FA verify, coupon/gift-card redeem,
  "send SMS/email" (cost and brute force) → per-account and per-IP limits
- search and list endpoints → maximum `limit`/`pageSize`, no unbounded
  `findAll()`, no client-controlled `include` depth
- uploads and bodies → size limits (`express.json({ limit })`, multer
  `limits`, `MAX_CONTENT_LENGTH`)
- expensive work (reports, exports, image processing, regex on user input)
  → limits or queues

If a limit may live outside the repo (API gateway, WAF, CDN), list the
route under Needs verification rather than as a finding.

**Incorrect:**

```js
router.post('/auth/verify-otp', async (req, res) => { /* 6-digit code, no attempt counter */ });
router.get('/products', (req, res) => Product.findAll({ limit: req.query.limit }));
```

- Error: 1,000,000 guesses cover every OTP; `?limit=10000000` loads the
  whole table.

**Correct:** rate limit and lock after N attempts; clamp
`limit = Math.min(Number(req.query.limit) || 20, 100)`.

**Why it matters:** Unlimited endpoints enable brute force, SMS/email cost
abuse and denial of service (OWASP API4:2023, API6:2023, CWE-307, CWE-770).
