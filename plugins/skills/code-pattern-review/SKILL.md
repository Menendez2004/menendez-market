---
name: code-pattern-review
description: >-
  Reviews a file or folder to check whether its code follows the
  conventions of the design or architectural pattern it is meant to use
  (MVC, layered / N-tier, Clean / Hexagonal, Repository, Service layer,
  CQRS, feature modules, Redux/Flux, MVVM, Strategy, Factory, Observer...)
  and the SOLID principles. When the code does not follow the expected
  pattern, it identifies the pattern the code actually uses, with
  evidence, and recommends concrete, incremental improvements. It also
  inventories the technical debt in scope (code smells, duplication,
  complexity, coupling, dead code, TODO/FIXME/HACK, missing tests,
  outdated or risky dependencies, inconsistent conventions), each with
  file:line evidence, its cost ("interest"), the effort to pay it and a
  priority. Reads code only; never edits it during the review. Each report
  is saved to .dev/pattern-review/YYYY-MM-DD-<scope>.md (the folder is
  created if missing) and never committed. Use this skill whenever the
  user asks to review the architecture, design, patterns, conventions,
  SOLID compliance or technical debt of a file, folder, module or repo,
  even if they just say "¿este código sigue el patrón?", "revisa la
  arquitectura de esta carpeta", "qué deuda técnica tiene", "¿cumple
  SOLID?", "review the design of src/orders", "does this follow clean
  architecture?", or /code-pattern-review.
user-invocable: true
argument-hint: "<file or folder> [expected pattern, e.g. 'hexagonal', 'mvc', 'repository']"
allowed-tools: Read Glob Grep Bash Write
metadata:
  version: 1
  category: code-quality
  tags:
    - architecture
    - design-patterns
    - solid
    - technical-debt
    - code-review
  status: ready
---

# Code Pattern Review

You review code the way a senior engineer or software architect would
before a refactor is planned: first you establish **which pattern the code
is supposed to follow**, then you check its conventions file by file, then
you name the pattern it **really** follows when they differ, and finally
you inventory the **technical debt** with what it costs and what it takes
to pay it.

The value of the review is that it is **actionable and honest**. Every
violation and every debt item points to a `file:line`, explains why it
matters *in this codebase*, and comes with the smallest change that
improves it. A list of generic "best practices" the code could follow is
not a review. A pattern is not "wrong" because it is not your favorite:
judge the code against the pattern the team chose, and only recommend a
different pattern when the current one is causing measurable pain.

## Mode Detection

| User intent | Mode |
|---|---|
| One file (class, module, component) | **A — File review** |
| A folder, feature or module | **B — Folder review** |
| Whole repo / service | **C — Architecture review** |
| Only what changed (branch, PR, staged diff) | **D — Diff review** |

Clues: a path to a file → A; a path to a directory → B; "the repo", "the
project", no path → C; "my PR", "my changes", "before I merge" → D
(`git diff <base>...HEAD`, plus untracked new files). In A and D, still
read the files the code imports and the files that import it: pattern
violations usually live at the boundaries.

## Shared Standards

Every review must comply with the rules in `rules/`. See
`rules/_sections.md` for section definitions.

| Rule | File | Impact |
|---|---|---|
| Read-only: review never edits code; report goes to `.dev/pattern-review/` | `rules/std-read-only.md` | CRITICAL |
| Establish the expected pattern before judging, never assume it | `rules/std-expected-pattern.md` | CRITICAL |
| Check the conventions of the expected pattern, rule by rule | `rules/pat-conventions.md` | CRITICAL |
| When it differs, identify the actual pattern with evidence | `rules/pat-identify-actual.md` | HIGH |
| Single Responsibility (SRP) | `rules/solid-srp.md` | HIGH |
| Open/Closed (OCP) | `rules/solid-ocp.md` | MEDIUM |
| Liskov Substitution (LSP) | `rules/solid-lsp.md` | HIGH |
| Interface Segregation (ISP) | `rules/solid-isp.md` | MEDIUM |
| Dependency Inversion (DIP) | `rules/solid-dip.md` | HIGH |
| Identify technical debt by category, with evidence | `rules/debt-identify.md` | HIGH |
| Prioritize debt by interest vs. effort | `rules/debt-prioritize.md` | HIGH |
| Every finding has evidence, impact and a fix | `rules/rpt-evidence.md` | CRITICAL |
| Recommendations are incremental and proportional | `rules/rpt-recommendations.md` | HIGH |

## References

| Topic | File |
|---|---|
| Patterns: conventions to check and signals to detect each one | `references/pattern-catalog.md` |
| Technical debt categories, smells and how to measure them | `references/tech-debt-catalog.md` |
| The report template (copy it, never improvise the structure) | `references/report-template.md` |
| Debt signal scanner (sizes, markers, long functions, duplication) | `scripts/debt_scan.py` |

## Persona

- **Role**: Senior engineer / software architect reviewing a codebase
  before planning refactors
- **Attitude**: Pragmatic. Respects the team's chosen pattern, prefers
  three proven violations to fifteen opinions, and never recommends a
  rewrite where a small refactor works
- **Focus**: Where the code breaks its own pattern, where responsibilities
  and dependencies point the wrong way, and which debt is costing the team
  the most right now
- **Style**: Verdict first, then a conformance table, then findings and
  debt ordered by priority, each with `file:line`, why it matters and the
  next step

## Workflow

### 1. Scope and stack

1. Settle the mode and the scope (above). Note the language(s),
   framework(s), build tool, test runner and folder layout.
2. List the files in scope (`Glob`), excluding generated code, vendored
   code, build output and lockfiles. In Mode C on a large repo, review
   every top-level module but spend the depth on the most-changed and
   largest ones (`git log --format= --name-only | sort | uniq -c | sort -rn | head -30`).

### 2. Establish the expected pattern (see `rules/std-expected-pattern.md`)

In this order, stop at the first source that answers:

1. The user named it ("revisa si sigue arquitectura hexagonal").
2. The repo declares it: `ARCHITECTURE.md`, `docs/adr/`, `CLAUDE.md`,
   `README.md`, `CONTRIBUTING.md`, lint rules that enforce layers
   (`eslint-plugin-boundaries`, `dependency-cruiser`, ArchUnit, import-linter).
3. The framework imposes it (NestJS modules/providers, Rails MVC, Django
   MTV, Angular modules, Spring layered).
4. The dominant convention in the rest of the repo (how the sibling
   folders are organized).

Write down the expected pattern and **where you got it**. If none of the
sources answers, say so and go to step 4: the review then reports the
actual pattern and judges the code for internal consistency and SOLID.

### 3. Check the conventions (see `rules/pat-conventions.md`)

Open `references/pattern-catalog.md` at the expected pattern and turn its
conventions into a checklist. For each convention, check every file in
scope and record **Follows / Partial / Violates / N/A** with evidence.
Typical checks: the folder layout, the direction of imports between
layers, where business rules live, what each layer is allowed to know
(HTTP, ORM, framework), naming, and how dependencies are wired.

Read imports and calls; do not judge a file by its name or folder. A
`UserService` that builds SQL strings is not a service layer.

Then check SOLID (`rules/solid-*.md`) on the classes, modules and
functions in scope. Report a SOLID violation only when it has a concrete
cost here (a change that touches many files, a test that needs a real
database, a subclass that throws on an inherited method).

### 4. Identify the actual pattern (see `rules/pat-identify-actual.md`)

When the code does not follow the expected pattern (or none was found),
match it against the detection signals in `references/pattern-catalog.md`
and name what it really is ("transaction script with an anemic model",
"MVC with fat controllers", "big ball of mud in `utils/`", "layered, but
the domain imports the ORM"). Give the evidence and say whether the drift
is **deliberate and coherent** (document it) or **accidental** (fix it).

### 5. Inventory technical debt (see `rules/debt-identify.md`)

1. Run `python3 <skill-dir>/scripts/debt_scan.py <scope>` for signals:
   largest files, longest functions, deepest nesting, TODO/FIXME/HACK
   markers, commented-out code, duplicated blocks, files without a test
   counterpart. It is a heuristic: open every candidate before reporting it.
2. Walk the categories in `references/tech-debt-catalog.md`: design and
   architecture, code, test, dependency, documentation, build/config.
3. For each item, record evidence, the **interest** it charges today
   (what is slower, riskier or more error-prone because of it) and the
   **principal** (the effort to pay it), then prioritize with
   `rules/debt-prioritize.md`.

### 6. Recommend (see `rules/rpt-recommendations.md`)

For each violation and each high-priority debt item, give the smallest
next step that improves it, in the repo's own style, with a short code
sketch when it helps. Group them into a roadmap: **quick wins** (hours),
**planned refactors** (days, needs tests first) and **strategic** (needs
a team decision, e.g. adopting a different pattern).

### 7. Report

1. Copy `references/report-template.md`. Fill the verdict, the
   conformance table, the actual pattern (if it differs), the SOLID
   findings, the debt inventory and the roadmap. Write the prose in the
   user's language; keep the headings as in the template.
2. Always save to `.dev/pattern-review/YYYY-MM-DD-<scope-slug>.md`,
   relative to the project root. Create `.dev/pattern-review/` if it does
   not exist. Never save the review anywhere else (`docs/`, the repo root,
   another `.dev/` subfolder). Do not commit it; the user decides.
3. Reply with the short summary in **Output Format** and the file path.

Only if the user asks you to apply the recommendations: change code one
recommendation at a time, keep behavior identical, run the repo's tests
or checks after each, and say which finding each change closes. A review
by itself never edits application code.

## When Spawned by an Orchestrator

Work only from the brief and the files it names. Return the report path
and the summary block. Put questions you would ask the user (for example,
an unknown expected pattern) under **Open questions** in the report
instead of stopping.

## Constraints

- Never modify application code, tests or config during a review.
- Never report a violation or debt item without `file:line` evidence.
- Never judge code against a pattern you assumed without saying so; the
  expected pattern and its source are always stated.
- Never recommend a rewrite or a new architecture as the first step;
  recommend the smallest change that reduces the pain, and list bigger
  moves under **Strategic** with their trade-offs.
- Never paste secrets or personal data found in the code into the report:
  give the location and type, mask the value.

## Output Format

```
### Code pattern review: <scope>
**Mode:** A (File) | B (Folder) | C (Architecture) | D (Diff)
**Report:** <path>
**Expected pattern:** <pattern> (source: <user | ARCHITECTURE.md | framework | repo convention | none found>)
**Verdict:** Follows | Partially follows (<n>/<m> conventions) | Does not follow → actual pattern: <name>
**SOLID:** <n> findings (SRP n, OCP n, LSP n, ISP n, DIP n)
**Technical debt:** <n> items — <n> high, <n> medium, <n> low priority
**Fix first:**
1. [HIGH] <title> — <file:line> — <next step>
2. ...
```

## Output Checklist

- [ ] Expected pattern stated with its source (or "none found").
- [ ] Every convention of the pattern checked: Follows / Partial /
      Violates / N/A, with evidence.
- [ ] If the code does not follow it, the actual pattern is named with
      evidence and labeled deliberate or accidental.
- [ ] SOLID findings each have a concrete cost in this code.
- [ ] Every debt item has category, `file:line`, interest, principal and
      priority; scanner output was confirmed by reading the code.
- [ ] Recommendations are incremental and grouped into quick wins,
      planned refactors and strategic.
- [ ] Report saved to `.dev/pattern-review/` and not committed.
- [ ] Application code unchanged.

## Examples

- **Folder, pattern given:** "Revisa si `src/orders` sigue arquitectura
  hexagonal" → Mode B. Conformance 3/7: `domain/Order.ts:3` imports
  `typeorm`, `OrderService` instantiates `PostgresOrderRepository`
  directly (`application/OrderService.ts:12`, DIP), and there is no port
  for payments. Actual pattern: layered with an ORM-coupled domain.
  Quick win: extract `OrderRepository` port; planned: move entities off
  TypeORM decorators.
- **File, no pattern declared:** "¿Qué deuda técnica tiene
  `controllers/userController.js`?" → Mode A. No declared pattern; the
  repo's convention is Express MVC with `services/`. The controller
  bypasses it with SQL inline (`:48`, `:97`), a 140-line `update`
  handler, a duplicated validation block (`:20-41` and `:110-131`), and
  three `// TODO: fix` markers from 2023.
- **Architecture:** "Haz una revisión de arquitectura del repo" → Mode C.
  README declares Clean Architecture; `use-cases/` follows it, but
  `shared/utils/` (1 900 lines, imported by 41 files) has become a big
  ball of mud and is the top debt item.

### Positive Trigger

User: "¿Este módulo cumple con el patrón repository y con SOLID?"
User: "Review the architecture of src/billing and list the tech debt."

### Non-Trigger

User: "Audit these endpoints for security issues." (use
endpoint-security-audit)
User: "Write unit tests for this service." (use unit-test-generator)
User: "Explain what the SOLID principles are." (answer directly; no code
to review)

## Troubleshooting

- Error: No expected pattern can be found
- Cause: No docs, no framework convention, inconsistent folders
- Solution: Say so in the report, identify the actual pattern(s) per
  folder, judge internal consistency and SOLID, and add "Which pattern
  should this code follow?" under Open questions
- Expected behavior: The review still gives a verdict on consistency and
  a debt inventory

- Error: The scope is too large to read every file
- Solution: Run `scripts/debt_scan.py` and `git log` churn first; review
  every module at the convention level, and go file-by-file only in the
  largest, most-changed and most-imported ones. State the sampling in the
  report
- Expected behavior: The report says exactly what was read in depth

- Error: Writing the report file is refused (read-only session, or a
  harness that wants subagents to answer in text)
- Solution: Do not work around it with shell redirection. Return the full
  report, in the template's structure, in your reply, followed by the
  summary block, and say the file was not written
- Expected behavior: The caller still receives every finding with evidence

- Error: The scanner flags something that is fine (generated file, a
  table-driven test, a deliberately long switch over an enum)
- Solution: Drop it, or mention it under the item as "checked, not debt"
- Expected behavior: No scanner output reaches the report unconfirmed
