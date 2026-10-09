---
title: Self-contained, readable with zero prior context
impact: HIGH
tags:
  - handoff
  - clarity
---

## Rule

Write for a reader who has never seen this conversation, this repo's
backend (or frontend), or the ticket:

- No references to the conversation: "as discussed", "the endpoint from
  before", "like we said".
- Name things by their full identifier: full path with prefix, file paths
  relative to the repo root, exact component/function names.
- Define once in `## Conventions` everything that applies to all endpoints
  (base URL, auth, casing, dates, money, IDs, pagination, error envelope),
  and do not contradict it per endpoint.
- `## What the receiver must do` is an imperative, numbered task list,
  plus an explicit **Out of scope** line.
- Links (ticket, design, PR) are extras, never the only place where a
  requirement lives: copy the requirement into the handoff.

**Incorrect:**

```markdown
Use the same auth as the other one and handle the errors we talked about.
```

**Correct:**

```markdown
| Auth | `Authorization: Bearer <access_token>` from the auth store |
...
| 409 | `OUT_OF_STOCK` | not enough stock for a line | mark that line out of stock |
```

**Why it matters:** The receiver is often another Claude session started
from nothing but this file. Anything not written in it does not exist for
them.
