---
title: Every error the endpoint can return is documented
impact: HIGH
tags:
  - handoff
  - errors
  - status-codes
---

## Rule

- Document the error envelope once, in `## Conventions`, copied from the
  global error handler, and say which fields are stable (`code`) and
  which are not (`message`).
- Per endpoint, the `#### Errors` table lists every non-2xx status the
  endpoint can produce: `| Status | code | When | Receiver must |`.
  Include the ones added by the framework and middleware: validation
  (`400`/`422`), auth (`401`), authorization (`403`), not found (`404`),
  conflicts and duplicates (`409`), idempotency, rate limit (`429`),
  payload too large (`413`) when relevant.
- `Receiver must` is concrete. Frontend receiver: the UI behavior (message,
  field highlight, redirect, retry rule). Backend receiver: the condition
  to detect and the code to return.
- Do not list `500` per endpoint unless the receiver must handle it
  differently from the app's generic error handling.

**Incorrect:**

```markdown
#### Errors
Standard errors.
```

**Correct:**

```markdown
| 409 | `OUT_OF_STOCK` | not enough stock for a line; `details[].field` names it | mark that line out of stock and ask the user to adjust it |
```

**Why it matters:** Error handling is where the two sides diverge most:
the backend returns `409`, the frontend expects `400`, and the user sees
"Something went wrong".
