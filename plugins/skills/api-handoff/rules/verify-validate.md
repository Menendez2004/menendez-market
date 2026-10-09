---
title: Validate the file before handing it over
impact: HIGH
tags:
  - handoff
  - validation
---

## Rule

Run the validator on every handoff you write, revise or receive:

```bash
python3 <skill-dir>/scripts/validate_handoff.py docs/handoffs/<file>.handoff.md
```

(`<skill-dir>` is the directory that contains this skill's `SKILL.md`.)

- Writer (Modes A, B, D): fix every `ERROR` before reporting. Read every
  `WARNING` and fix it or say why it stays.
- Implementer (Mode C): run it before writing code. Errors in a handoff
  you received are reported back to its author; do not fix someone
  else's contract by guessing.
- The validator checks structure, front matter, JSON parsing, body table
  ↔ example consistency, `ready` vs open questions, and common secret
  shapes. It does **not** check that the contract matches the code; that
  is `src-code-is-truth.md`, and still yours.

If Python is not available, walk the Output Checklist in `SKILL.md`
manually and say in the report that the validator was not run.

**Why it matters:** A structurally broken handoff fails silently in the
receiver's session: a missing section looks like "not applicable".
