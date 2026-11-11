---
title: Establish the expected pattern before judging, never assume it
impact: CRITICAL
tags:
  - pattern
  - scope
  - fairness
---

## Rule

Before checking any convention, write down the **expected pattern** and
the **source** it came from. Use the first source that answers, in this
order:

1. **The user** named it in the request.
2. **The repo declares it**: `ARCHITECTURE.md`, `docs/adr/*`, `CLAUDE.md`,
   `README.md`, `CONTRIBUTING.md`, or tooling that enforces it
   (`eslint-plugin-boundaries`, `dependency-cruiser` rules, ArchUnit tests,
   `import-linter` contracts, Nx module boundaries).
3. **The framework imposes it**: NestJS (modules, controllers, providers),
   Rails / Laravel / ASP.NET MVC, Django (MTV + apps), Spring (layered
   controller → service → repository), Angular (modules/standalone
   components + services), Next.js app router conventions.
4. **The repo's own convention**: how the sibling folders of the scope
   are organized. Name the folders you compared.

If two sources disagree (the README says hexagonal, the code is layered
everywhere), report both: the declared pattern is the expected one, and
the disagreement is itself a finding (documentation debt or architectural
drift).

If no source answers, write **"Expected pattern: none found"**, review the
code for internal consistency and SOLID, name the actual pattern, and add
"Which pattern should this code follow?" under Open questions.

**Incorrect:**

```markdown
The project does not follow Clean Architecture: there are no use cases.
```

- Error: Judges the code against a pattern nobody chose.

**Correct:**

```markdown
**Expected pattern:** Layered MVC (controller → service → repository)
**Source:** repo convention — `src/users`, `src/products` and `src/cart`
all follow it; no architecture docs found.
```

**Why it matters:** A pattern is a team decision. Reporting "violations"
of a pattern the team never adopted is noise, and it hides the real
problem: code that breaks the pattern the team did adopt.
