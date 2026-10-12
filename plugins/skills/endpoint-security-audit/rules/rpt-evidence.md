---
title: Every finding has evidence, a trigger and a fix
impact: CRITICAL
tags:
  - reporting
  - evidence
  - false-positives
---

## Rule

A finding is reported only when all of these are written down:

1. **Location**: the route (`METHOD /full/path`) and every `file:line` on
   the path from source to sink, including the line that is missing a
   check.
2. **Trigger**: the concrete request (method, path, relevant headers, body)
   and the caller's position (anonymous, any user, user of another tenant).
3. **Why nothing stops it**: the middleware, validation and framework
   behavior you checked, and why each does not neutralize it.
4. **Impact**: what the attacker gets, in one sentence.
5. **Fix**: the specific change, as a short code snippet in the repo's own
   style, plus any test that would catch a regression.

If any of 1–3 cannot be established from the code, the item goes under
**Needs verification** with what someone must check (a gateway rule, a DB
row-level policy, a library's default). Do not report the same root cause
once per route: report it once, list every affected route.

**Incorrect:**

```markdown
### [HIGH] Possible SQL injection
The search feature may be vulnerable to SQL injection. Use parameterized queries.
```

**Correct:**

```markdown
### F2 [CRITICAL] SQL injection in product search
- **Route:** `GET /api/search` (any caller, no auth)
- **Path:** `routes/search.js:5` reads `req.query.q` → `services/search.js:8`
  interpolates it into `db.query(\`... LIKE '%${q}%'\`)`
- **Trigger:** `GET /api/search?q=x'%20UNION%20SELECT%20email,password_hash%20FROM%20users--`
- **Why not stopped:** no validation middleware on the route; `db.query`
  is called with a single string and no parameters.
- **Impact:** read any table, including password hashes.
- **Fix:** `db.query('SELECT ... WHERE name LIKE $1', [\`%${q}%\`])`
- **Mapping:** OWASP API8:2023 · CWE-89
```

**Why it matters:** Developers fix what they can reproduce. A vague
finding costs them an investigation and, if it turns out false, costs the
report its credibility.
