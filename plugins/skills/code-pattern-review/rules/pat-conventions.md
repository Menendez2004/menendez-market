---
title: Check the conventions of the expected pattern, rule by rule
impact: CRITICAL
tags:
  - pattern
  - conformance
  - architecture
---

## Rule

Turn the expected pattern's entry in `references/pattern-catalog.md` into
a checklist and check **every** convention against the code in scope.
Record each one as:

| Status | Meaning |
|---|---|
| **Follows** | Every file in scope respects it |
| **Partial** | Most files respect it; list the exceptions with `file:line` |
| **Violates** | The convention is broken as a rule, not an exception |
| **N/A** | Does not apply to this scope (say why) |

Judge from what the code **does**, not from names or folders:

- **Layer direction:** follow the `import`/`require`/`using` statements.
  An inner layer (domain, entities, use cases) that imports an outer one
  (HTTP, ORM, framework, UI) violates the dependency rule, wherever the
  file sits.
- **Responsibility placement:** find where business rules actually run
  (validation of domain invariants, price/stock/permission logic). If they
  are in controllers, views, SQL or React components when the pattern puts
  them in services/domain, that is a violation.
- **Wiring:** how collaborators are obtained. `new ConcreteDep()` inside a
  service of a pattern that expects injection is a violation.
- **Naming and placement:** file and symbol names, folder structure,
  one-concept-per-file if the pattern expects it.
- **Consistency:** the same thing done the same way across the scope
  (one way to access data, one way to handle errors, one way to validate).

The verdict is **Follows** (all Follows/N/A), **Partially follows**
(`n/m` conventions Follows, rest Partial) or **Does not follow** (one or
more conventions Violates, or most are Partial).

**Incorrect:**

```markdown
The folder structure looks like MVC, so it follows the pattern.
```

**Correct:**

```markdown
| # | Convention | Status | Evidence |
|---|---|---|---|
| C1 | Controllers only parse the request and delegate | Partial | `controllers/order.js:31-88` computes discounts and writes to the DB |
| C2 | Data access only through models/repositories | Violates | raw SQL in `controllers/order.js:52`, `controllers/user.js:17`, `views/report.ejs:4` |
| C3 | Views contain no business logic | Follows | — |
```

**Why it matters:** A folder named `services/` proves nothing. Checking
each convention against real imports and calls is what tells the team
exactly where the pattern breaks and how widespread the break is.
