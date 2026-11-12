# ponytail in merge-readiness-review (strict)

`ponytail` is a code-minimalism skill: before code is written it asks
whether the code needs to exist (YAGNI), prefers the standard library and
native platform features over custom code or new dependencies, and keeps
validation, error handling, security and accessibility. In this skill its
use is a **strict rule** (`rules/std-ponytail.md`): if it is available it
is always loaded; it is never installed.

## 0. Availability check (once, step 0, before reading the diff)

Check in order, stop at the first hit:

1. **Skill in the harness**: `ponytail` or `ponytail:ponytail` (or any
   `<plugin>:ponytail`) in the current skill list.
2. **Skill on disk**: `<root>/.claude/skills/ponytail/SKILL.md`, then
   `~/.claude/skills/ponytail/SKILL.md`.

Load it: invoke it with the `Skill` tool; if the name is not invocable in
this session, `Read` the `SKILL.md` path and apply it. Level: the one the
user named ("ponytail ultra", "ponytail lite"), otherwise the skill's
default; do not ask for it.

Record exactly one of:

- `ponytail: loaded (skill <name> | file <path>), level <level>`
- `ponytail: not available` — never install it, never ask the user to.
- `ponytail: available but failed to load (<error>)` — say so in the
  report's Open questions; the review is otherwise complete.

## 1. What it evaluates here

The reviewer writes no code during the review, so ponytail is applied as
a lens on the **incoming diff** (step 5) and, if the user asks for fixes,
on the code written in step 8. Look for:

| Signal | Example finding |
|---|---|
| Code that does not need to exist for the change's goal | a config option nobody sets; an unused helper; a speculative extension point |
| Stdlib / platform / framework feature reimplemented | custom deep clone where `structuredClone` exists; hand-rolled date math the repo already does with its date lib |
| New dependency where the target already has an equivalent, or the stdlib covers it | `lodash.clonedeep` added; `left-pad` for one call |
| Duplicates code that already exists on the target | a second `formatMoney` next to `shared/money.ts:formatMoney` |
| Abstraction with one implementation and no second in sight | interface + factory + registry for one class |

Each finding: `M#`, `file:line`, the simpler alternative with a pointer
to where it already exists (if it does), and what the change would save.

## 2. Precedence — scope and safety win

- ponytail decides **how much code**, never **what the change must do**.
  The feature, the ticket and the user's intent win.
- Never recommend removing validation, error handling, security checks,
  accessibility, migrations or tests.
- Minimalism findings are **MEDIUM or LOW** and alone never make the
  verdict "Not ready". They raise the severity only when they are also a
  merge breakage (e.g. the new dependency conflicts with the target's
  lockfile or duplicates a version) — then the breakage is the finding.
- If ponytail suggests a native/stdlib option that would change a
  contract other flows use, list it as an Open question, not a fix.
- In step 8 (fixes), ponytail keeps each fix minimal; it never widens the
  fix to clean up unrelated code.
