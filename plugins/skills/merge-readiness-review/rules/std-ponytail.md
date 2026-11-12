---
title: ponytail is mandatory when available (strict)
impact: CRITICAL
tags:
  - ponytail
  - minimalism
  - strict
---

## Rule

`ponytail` is the code-minimalism skill. Its use in this skill is
**strict, not optional**:

1. **Check, always, before step 1**: the skill list (`ponytail`,
   `ponytail:ponytail`), then `<root>/.claude/skills/ponytail/SKILL.md`,
   then `~/.claude/skills/ponytail/SKILL.md`.
2. **If found, load it** (Skill tool; if the name is not invocable, read
   the `SKILL.md` file) **before reading the diff**, at the level the user
   named or the skill's default. Keep it in effect for the diff review
   (step 5) and for any fix (step 8).
3. **Record it** in the report header and the summary:
   `ponytail: loaded (<name|path>), level <level>` or `ponytail: not available`.
4. **If not found**: continue the review; never install it, never ask the
   user to install it.
5. A review where ponytail was available but not loaded is **incomplete**:
   do not deliver it; load ponytail and redo steps 5 and 7.
6. **Precedence** (`references/ponytail.md` §2): ponytail findings say
   *how much code* the change needs, never *what* it must do. Never
   recommend removing validation, error handling, security, accessibility,
   migrations or tests. Minimalism findings alone never make the verdict
   "Not ready"; they are conditions or notes, unless they are also a real
   breakage (e.g. a new dependency that conflicts with the target's lockfile).

**Incorrect:**

```markdown
**ponytail:** skipped (not needed for a review)
```

**Correct:**

```markdown
**ponytail:** loaded (ponytail, level default) — 2 minimalism findings
- M1 `utils/deepClone.ts:1-40` reimplements `structuredClone`, already used at `store/history.ts:12`.
- M2 new dependency `left-pad` for one call at `format/id.ts:8`; `String.prototype.padStart` covers it.
```

**Why it matters:** Code that should not exist is code every other flow
now has to keep working with. Checking it at the merge gate, every time,
is the only way it does not depend on someone remembering to.
