---
title: Data, secret and server-path exposure
impact: HIGH
tags:
  - security
  - information-disclosure
  - errors
---

## Rule

Check what each route and the app's error handling return to the client.
Nothing in a response should reveal another user's data, secrets,
internal identifiers the client does not need, stack traces, SQL, or
filesystem paths.

Check:

- **Error handlers**: `res.status(500).json({ error: err.message, stack: err.stack })`,
  `DEBUG=True`, `app.debug`, `ASPNETCORE_ENVIRONMENT=Development` in prod
  config, Express default handler with `NODE_ENV` unset, ORM errors passed
  through (they include SQL and column names).
- **Responses**: full models with `passwordHash`, `resetToken`,
  `apiKey`, `internalNotes`; storage keys or disk paths
  (`/srv/app/uploads/...`); internal hostnames; other tenants' records in
  list endpoints.
- **Headers**: `X-Powered-By`, server version banners.
- **Logs** that store tokens, passwords, card numbers or full request
  bodies with PII (report as LOW unless logs are exposed).
- **Hardcoded secrets** in route or config code: API keys, DB passwords,
  JWT secrets, private keys. Mask the value in the report.

**Incorrect:**

```js
// app.js:41
app.use((err, req, res, next) => res.status(500).json({ message: err.message, stack: err.stack }));
```

**Correct:**

```js
app.use((err, req, res, next) => {
  const ref = crypto.randomUUID().slice(0, 8);
  logger.error({ ref, err });
  res.status(500).json({ error: 'Something went wrong', ref });
});
```

**Why it matters:** Stack traces and paths map the server for an attacker;
over-broad responses leak data without any exploit at all (CWE-209,
CWE-200, CWE-532, CWE-798).
