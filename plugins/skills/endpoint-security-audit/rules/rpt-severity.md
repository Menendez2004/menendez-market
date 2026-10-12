---
title: Severity is assigned consistently
impact: HIGH
tags:
  - reporting
  - severity
---

## Rule

Score each finding by who can trigger it and what they get, using this
table. When between two levels, state the deciding factor in one line.

| Severity | Who can trigger | What they get | Typical examples |
|---|---|---|---|
| **CRITICAL** | Anonymous, or any user, with no special conditions | Other users' data at scale, account takeover, admin rights, code execution, moving money | SQLi on a public route, BOLA on payments/PII, forgeable JWT, mass assignment to `role`, RCE, traversal reading `.env` |
| **HIGH** | Any authenticated user, or anonymous with conditions | One user's data, privileged action, financial abuse needing timing, internal network access | BFLA on admin route, SSRF, race in transfers, stored XSS via upload |
| **MEDIUM** | Specific conditions or limited impact | Information that aids attacks, brute force, DoS of one route | Stack traces/paths in errors, no rate limit on login, permissive CORS without credentials, missing security headers |
| **LOW** | Hard to exploit or defense-in-depth | Minor info, hygiene | `X-Powered-By`, secrets in non-exposed logs, verbose 404s |

Adjustments:

- Unguessable IDs that are never shown to other users: BOLA may drop one
  level, never below MEDIUM.
- Money, health, identity or authentication data: raise one level for
  exposure findings.
- A finding that needs another finding first (e.g. requires admin)
  scores from the attacker's starting position.

**Why it matters:** Consistent severity lets the team fix in the right
order and compare audits over time.
