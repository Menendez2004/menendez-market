---
title: Never invent fields, codes or behavior; mark them as open
impact: CRITICAL
tags:
  - handoff
  - api-contract
  - open-questions
---

## Rule

If a value is not in the code (Mode A) and nobody decided it (Mode B),
write `TBD (Qn)` and add `Qn` to `## Open questions` with: the question,
who decides, and what it blocks. Never fill the gap with a plausible
value.

- A handoff with open questions has `status: draft`.
- `status: ready` means zero `TBD` and `## Open questions` says `None.`
  The validator enforces this.
- A sensible default can be *proposed* inside the question ("suggest
  50"), never written into the contract as if decided.
- If the code itself is ambiguous (an unhandled error path, a field the
  serializer may or may not include), that is an open question too.

**Incorrect:**

```markdown
| 429 | `RATE_LIMITED` | more than 100 requests / minute | retry after 60 s |
```

- Error: The API has no rate limiter; the row was added because "APIs
  usually have one".

**Correct:**

```markdown
| Rate limit | TBD (Q3) |
...
- **Q3** — Rate limit for this public endpoint. · decides: backend · blocks: nothing for the frontend
```

**Why it matters:** An invented value looks exactly like a real one. The
receiver implements it, and the two sides diverge silently. A visible
`TBD` costs one question; a fake value costs a bug.
