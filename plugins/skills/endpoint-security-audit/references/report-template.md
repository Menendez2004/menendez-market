# Report Template

Copy this structure exactly. Keep headings in English and in this order so
reports compare across audits; write the prose in the user's language.

````markdown
# Endpoint Security Audit — <service or scope>

| | |
|---|---|
| **Date** | YYYY-MM-DD |
| **Mode** | Full / Targeted / Diff |
| **Scope** | <repo path, files, routes, or base...head> |
| **Commit** | <branch>@<short sha> |
| **Stack** | <language, framework, ORM/DB, auth mechanism> |
| **Method** | Static source review: route map, then each input traced to its sinks. No live requests. |

## Summary

<2–4 sentences: the overall posture and the one thing to fix first.>

| Severity | Count |
|---|---|
| Critical | n |
| High | n |
| Medium | n |
| Low | n |

## Route map

| # | Method | Full path | Handler | Authentication | Authorization | Input validation | Risk tags | Findings |
|---|---|---|---|---|---|---|---|---|
| R1 | GET | `/api/orders/:id` | `routes/orders.js:14` → `controllers/orders.js:10` | `requireAuth` | none | none | PII | F1 |
| R2 | ... | | | | | | | — |

Risk tags: public, money, admin, file, outbound-url, pii, auth-flow.

## Findings

### F1 [CRITICAL] <short title>

- **Route(s):** `METHOD /path` (R1, R4)
- **Caller:** anonymous / any authenticated user / user of another tenant
- **Path:** `file:line` <what happens> → `file:line` <what happens>
- **Trigger:**
  ```http
  GET /api/orders/1042 HTTP/1.1
  Authorization: Bearer <token of user B>
  ```
- **Why existing checks do not stop it:** <middleware, validation, ORM behavior checked>
- **Impact:** <one sentence>
- **Fix:**
  ```js
  <minimal code change in the repo's style>
  ```
- **Regression test:** <the test that would catch it>
- **Mapping:** OWASP API1:2023 · CWE-639

### F2 [HIGH] ...

## Configuration findings

<Global issues (CORS, CSRF, headers, debug, error handler) reported once,
same fields as findings, with the routes they affect. Omit the section if
none.>

## Needs verification

| # | Route / area | What is uncertain | What to check |
|---|---|---|---|
| V1 | `POST /api/auth/login` | No rate limit in code | Gateway or WAF rate-limit rules for this path |

## Reviewed with no findings

<Routes traced with nothing found, so readers know they were covered:
`GET /api/products` (R3), `GET /health` (R9), ...>

## Out of scope / limits

<What was not reviewed and why: other services, compiled dependencies,
infrastructure, client apps.>
````
