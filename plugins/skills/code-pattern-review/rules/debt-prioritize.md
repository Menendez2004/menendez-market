---
title: Prioritize debt by interest vs. effort
impact: HIGH
tags:
  - technical-debt
  - prioritization
  - roadmap
---

## Rule

Assign each debt item a priority from its **interest** (cost of keeping
it) and its **principal** (cost of paying it), adjusted by **hotspot**:
code that changes often charges interest on every change.

| Interest \ Principal | S / M | L / XL |
|---|---|---|
| **High** (causes bugs, blocks features, security or data risk, hot file) | **HIGH — quick win, do now** | **HIGH — plan it** (split into steps) |
| **Medium** (slows changes, confuses readers) | **MEDIUM — do with the next change nearby** | **MEDIUM — backlog with a trigger** |
| **Low** (cosmetic, code that never changes) | **LOW — boy-scout rule** | **LOW — accept and document** |

Adjustments:

- **Hotspot:** high churn in `git log` (top 10% of changed files in the
  last 6 months) raises interest one level.
- **Cold code:** stable code nobody touches lowers interest one level,
  even if it is ugly.
- **Blast radius:** code imported by many modules raises interest one
  level.
- **Prerequisite:** if an item must be paid before others (missing tests
  before a refactor), say so and order it first.

Order the debt inventory by priority, then by interest. Accepting debt is
a valid outcome: say why.

**Incorrect:**

```markdown
D1–D14 listed in file order, all "should be fixed".
```

**Correct:**

```markdown
| ID | Item | Interest | Principal | Hotspot | Priority |
|---|---|---|---|---|---|
| D2 | Duplicated address validation | High (caused bug a41c9e2) | S | yes | HIGH — quick win |
| D5 | `shared/utils.ts` god module | High (41 importers) | XL | yes | HIGH — plan it |
| D9 | Legacy `reports/` callbacks | Low (untouched since 2023) | L | no | LOW — accept and document |
```

**Why it matters:** Teams never pay all their debt. Ordering by interest
and effort makes sure the hours go where they save the most.
