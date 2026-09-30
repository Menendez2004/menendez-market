---
title: Keep credentials out of reports, issues and run files
impact: CRITICAL
tags:
  - qa
  - orchestration
  - secrets
  - reporting
  - issues
---

## Rule

Before anything leaves an agent (run file, summary, report, issue, comment),
redact every value that comes from `.env.qa` and every credential seen in
traffic: passwords, tokens, API keys, cookies, `Authorization` headers,
webhook signatures and signing secrets. Replace each with `<redacted:KEY>`
(the `.env.qa` key name when known).

**Incorrect (bug reproduction in a GitHub issue):**

```
POST /api/v1/orders
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Body: {"email": "qa-admin@acme.test", "password": "S3cret!", "qty": 0}
→ 500 Internal Server Error
```

- Error: The token and admin password are now in a GitHub issue, and in the
  committed report under `.qa/reports/`.
- Cause: The agent copied the raw request into its bug report.

**Correct (same reproduction):**

```
POST /api/v1/orders
Authorization: Bearer <redacted:QA_AUTH_TOKEN>
Body: {"email": "<redacted:QA_ADMIN_EMAIL>", "password": "<redacted:QA_ADMIN_PASSWORD>", "qty": 0}
→ 500 Internal Server Error
```

- Still reproducible: whoever fixes it has `.env.qa` and knows which key to use.

**Rules:**

- In Phase 1 the Orchestrator checks which `.env.qa` keys are set; it never
  prints their values or copies them into briefs.
- Every agent brief tells the agent to redact as above in all its output.
- Before writing the report or filing an issue, the Orchestrator scans the
  text for each non-empty `.env.qa` value and redacts any match.

**Why it matters:**

QA reports are committed and uploaded as CI artifacts, and in CI HIGH+ bugs
become GitHub issues. A leaked credential there cannot be taken back by
deleting the file or the issue: it stays in git history, caches and
notifications, and has to be rotated.
