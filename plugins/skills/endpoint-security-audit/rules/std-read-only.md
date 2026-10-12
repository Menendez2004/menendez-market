---
title: Read-only, static, and only against code the user owns
impact: CRITICAL
tags:
  - audit
  - scope
  - safety
---

## Rule

An audit reads source code and configuration. It does not send requests to
deployed systems, run scanners or exploits, or edit application code.

- Allowed: reading files, `grep`, `git diff`/`git log`, running
  `scripts/list_routes.py`, a framework's own route-listing command
  (`flask routes`, `rails routes`, `php artisan route:list`) if it does not
  need network or production credentials.
- Not allowed: `curl`/`fetch` against any host, starting the app against a
  real database, running sqlmap/nuclei/ZAP, writing to the repo other than
  the report file.
- A fix is applied only when the user asks for it after the audit, one
  finding at a time.

**Incorrect:**

```bash
curl "https://api.example.com/api/search?q=' OR 1=1--"
```

- Error: Attacks a live system to "confirm" a SQL injection the code already
  proves.

**Correct:**

```text
services/search.js:8 builds `... LIKE '%${q}%'` and passes it to db.query()
with no parameters; q comes from req.query.q (routes/search.js:5).
Trigger: GET /api/search?q=%27%20OR%201%3D1--
```

**Why it matters:** The user asked for an audit, not a penetration test. A
live request can corrupt data, trip alerts or hit a system the user has no
authority over. The source code is enough to prove a flaw and is safe.
