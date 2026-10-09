---
title: Use the fixed template and front matter
impact: CRITICAL
tags:
  - handoff
  - template
  - machine-readable
---

## Rule

Every handoff is a copy of `references/handoff-template.md`:

- YAML front matter with every required field (`handoff`, `title`,
  `direction`, `receiver`, `status`, `revision`, `created`, `updated`,
  `author`, `source.{repo,branch,commit}`, `endpoints[]`).
- Headings exactly as in the template, in English, at the same level and
  in the same order, even when the prose is in another language.
- One `## Endpoint N — METHOD /path` per item in `endpoints`, same order,
  same method and path.
- Sections that do not apply stay, with `None.` (or `No body.` for
  `#### Body`) under them. An empty or missing section means "forgot";
  `None.` means "checked".
- File name `YYYY-MM-DD-<feature-slug>.handoff.md`, in the repo's handoff
  folder or `docs/handoffs/`.

**Incorrect:**

```markdown
## POST /orders
Sends the cart. Body: items, address. Returns the order.
```

- Error: No front matter, no fixed headings, no body table, no errors, no
  acceptance criteria. A receiving session cannot tell what is missing
  versus not applicable.

**Correct:** the full `## Endpoint 1 — POST /api/v1/orders` block from
`references/examples/backend-to-frontend.handoff.md`.

**Why it matters:** The receiving session (and the validator) navigate the
document by its headings. A fixed shape is what lets any Claude session
pick up any handoff and know where everything is.
