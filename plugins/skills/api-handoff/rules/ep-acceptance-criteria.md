---
title: Testable acceptance criteria for the receiving side
impact: HIGH
tags:
  - handoff
  - acceptance-criteria
  - definition-of-done
---

## Rule

Each endpoint ends with `### Acceptance criteria`: a checklist the
**receiver** can verify to know their side is done.

- Format: `- [ ] AC-<endpoint>.<n> <statement>` (e.g. `AC-1.3`), so the
  implementing session can report each one by id.
- Each criterion is observable and testable: given a situation, when an
  action happens, then a specific result (status, field value, UI state,
  request sent).
- Cover the happy path, each error the receiver must handle, and the
  edge cases the handoff calls out (empty list, last page, idempotent
  retry).
- Written for the receiver: frontend criteria describe UI behavior and
  requests sent; backend criteria describe responses and persisted state.
- No vague words: "works", "handles errors", "fast", "correctly".

**Incorrect:**

```markdown
- [ ] The checkout works and errors are handled.
```

**Correct:**

```markdown
- [ ] AC-1.4 On `409 OUT_OF_STOCK`, the affected line is marked out of stock and no navigation happens.
```

**Why it matters:** Without them, "done" means whatever the implementer
thought. With them, the implementing session can prove it met the
contract, criterion by criterion.
