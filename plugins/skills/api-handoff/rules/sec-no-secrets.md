---
title: No secrets, tokens or real personal data
impact: CRITICAL
tags:
  - handoff
  - security
  - secrets
---

## Rule

Handoffs get pasted into tickets, chats, PRs and other sessions. They must
never contain:

- Tokens, API keys, passwords, cookies, session ids, signing secrets,
  private keys, connection strings.
- Internal-only hostnames or IPs; use `{API_BASE_URL}`.
- Real customer data (names, emails, phones, addresses, document numbers)
  copied from a database, log or real response.

Use placeholders instead:

| Instead of | Write |
|---|---|
| a real JWT | `Bearer <access_token>` |
| an API key | `<API_KEY>` (and say where the receiver gets it, e.g. "from the team vault, key `PAYMENTS_API_KEY`") |
| a hostname | `{API_BASE_URL}` |
| a real person | `Example User`, `user@example.com`, `Av. Ejemplo 123` |
| a real id from prod | a freshly made-up UUID |

When you capture a real response to build an example, replace every
value before writing it. The validator flags common token shapes, but it
cannot recognize personal data: that check is yours.

**Incorrect:**

```markdown
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." https://orders.internal.acme.net/api/v1/orders
```

**Correct:**

```markdown
curl -H "Authorization: Bearer <access_token>" "{API_BASE_URL}/api/v1/orders"
```

**Why it matters:** A secret in a handoff is a secret in every place the
handoff is copied to, and it cannot be un-shared.
