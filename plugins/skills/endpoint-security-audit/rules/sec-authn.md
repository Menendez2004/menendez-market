---
title: "Authentication: present, enforced, not bypassable"
impact: CRITICAL
tags:
  - security
  - authentication
  - jwt
  - owasp-api2
---

## Rule

For every route, decide whether it must be authenticated and prove from the
middleware chain whether it is. Then check the auth mechanism itself.

Check:

- **Missing auth** on a route that reads or changes non-public data. Watch
  ordering (`router.use(auth)` after the route), routers mounted before the
  auth middleware, `@Public()` / `AllowAnonymous` / `permit_all` opt-outs,
  and catch-all `skip` lists in global middleware (`if (req.path.startsWith('/api/public'))`
  matched by `/api/public/../admin`?).
- **JWT**: `jwt.decode` instead of `verify`; `verify` without pinning
  `algorithms` (alg confusion, `none`); secret with a hardcoded fallback
  (`process.env.JWT_SECRET || 'dev'`); no expiry check; trusting claims
  like `role` or `userId` without server-side lookup when roles can change.
- **Sessions/cookies**: missing `httpOnly`, `secure`, `sameSite`; session
  not regenerated on login.
- **Passwords**: plain or fast hashes (md5, sha1, sha256 without KDF)
  instead of bcrypt/scrypt/argon2; non-constant-time comparison of tokens.
- **Login / reset / OTP flows**: different responses for unknown user vs.
  wrong password (enumeration), reset tokens that are guessable, reusable
  or never expire.
- **API keys / webhooks**: webhook endpoints that do not verify the
  provider's signature.

**Incorrect:**

```js
// middleware/auth.js:6
const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
```

- Error: If `JWT_SECRET` is unset in any environment, anyone can sign tokens
  with the public default. No `algorithms` option either.

**Correct:**

```js
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET is required');
const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
```

**Why it matters:** Authentication is the outer wall. One unprotected route
or forgeable token gives an attacker every user's access (OWASP API2:2023,
CWE-287, CWE-306, CWE-798).
