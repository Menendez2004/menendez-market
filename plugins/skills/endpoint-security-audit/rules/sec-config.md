---
title: CORS, CSRF, headers, debug and other configuration
impact: MEDIUM
tags:
  - security
  - configuration
  - cors
  - csrf
  - owasp-api8
---

## Rule

Check application-wide configuration once and report each issue once, with
the routes it affects.

Check:

- **CORS**: `origin: true` / `*` / reflecting `req.headers.origin` together
  with `credentials: true`; regex allowlists that match `evil-example.com`.
- **CSRF**: cookie-based auth with state-changing routes and no CSRF token
  or `SameSite=Lax/Strict` cookies. (Bearer tokens in headers are not
  CSRF-prone.)
- **Security headers**: no Helmet or equivalent (`Strict-Transport-Security`,
  `X-Content-Type-Options`, `Content-Security-Policy` for HTML responses).
- **Debug / dev settings** reachable in production config: debug mode,
  GraphQL introspection and playground, Swagger UI with try-it-out on
  production, `/actuator` endpoints, verbose ORM logging.
- **Inventory** (OWASP API9): old versions (`/v1` still mounted after
  `/v2`), test or seed routes (`/debug`, `/seed`, `/test-login`) left
  registered.
- **Third-party APIs** (OWASP API10): responses from external services
  trusted without validation, webhooks without signature checks, TLS
  verification disabled (`rejectUnauthorized: false`, `verify=False`).

**Incorrect:**

```js
app.use(cors({ origin: true, credentials: true }));
```

- Error: Any website can make authenticated requests with the user's
  cookies and read the responses.

**Correct:**

```js
app.use(cors({ origin: ['https://app.example.com'], credentials: true }));
```

**Why it matters:** One permissive global setting weakens every endpoint
at once (OWASP API8:2023, API9:2023, API10:2023, CWE-942, CWE-352,
CWE-295).
