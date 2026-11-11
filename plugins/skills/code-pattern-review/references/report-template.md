# Report Template

Copy this structure exactly. Keep headings in English and in this order so
reviews compare over time; write the prose in the user's language. Save to
`.dev/pattern-review/YYYY-MM-DD-<scope-slug>.md`.

````markdown
# Code Pattern Review — <scope>

| | |
|---|---|
| **Date** | YYYY-MM-DD |
| **Mode** | File / Folder / Architecture / Diff |
| **Scope** | <path(s) or base...head> — <n> files, <n> lines |
| **Commit** | <branch>@<short sha> |
| **Stack** | <language, framework, ORM/DB, test runner> |
| **Expected pattern** | <pattern> |
| **Source of the expected pattern** | <user / ARCHITECTURE.md:line / framework / repo convention (folders compared) / none found> |
| **Method** | Static, read-only review: pattern conventions, SOLID, technical debt (`debt_scan.py` + manual confirmation). No code was changed. |

## Verdict

**<Follows | Partially follows (n/m conventions) | Does not follow>**

<2–4 sentences: the overall state, the actual pattern if it differs, and
the one thing to fix first.>

| Area | Result |
|---|---|
| Pattern conventions | n Follows · n Partial · n Violates · n N/A |
| SOLID findings | n (SRP n · OCP n · LSP n · ISP n · DIP n) |
| Technical debt | n items — n HIGH · n MEDIUM · n LOW |

## Pattern conformance

| # | Convention | Status | Evidence |
|---|---|---|---|
| C1 | <convention from references/pattern-catalog.md> | Follows / Partial / Violates / N/A | `file:line` … |
| C2 | ... | | |

## Actual pattern

<Only when the verdict is not "Follows" or no expected pattern was found;
otherwise write "Same as expected.">

- **Actual pattern:** <name, qualified>
- **Evidence:** `file:line`, `file:line`, …
- **Deliberate or accidental:** <which, and why>
- **Fit:** <does it fit this code's needs?>
- **Direction:** <move back to the expected pattern (first steps) / keep and document (trade-off)>

## Findings

Pattern violations and SOLID findings, ordered by severity
(HIGH → MEDIUM → LOW).

### P1 [HIGH] <short title> (<convention ID and/or SOLID principle>)

- **Location:** `file:line[-line]`
- **What it does:** <actual behavior, short snippet if useful>
- **Breaks:** <C# / SRP / OCP / LSP / ISP / DIP>
- **Impact here:** <concrete cost in this codebase>
- **Fix:**
  ```<lang>
  <minimal sketch in the repo's style>
  ```

### P2 [MEDIUM] ...

## Technical debt

| ID | Category | Item | Location | Interest | Principal | Hotspot | Priority |
|---|---|---|---|---|---|---|---|
| D1 | Code — duplication | <title> | `file:line` (+n) | High — <why> | S | yes | HIGH — quick win |
| D2 | ... | | | | | | |

### D1 · <Category> — <title>

- **Evidence:** `file:line`, …
- **Interest:** <what it costs today; facts from git/bugs when available>
- **Principal:** S / M / L / XL — <what paying it involves>
- **Kind:** <deliberate/inadvertent, prudent/reckless, if clear>
- **Payment:** <the refactoring or change>

## Roadmap

### Quick wins (≤ 1 day each)
1. <action> — closes P#, D# — S

### Planned refactors (need tests first)
1. <action> — closes P#, D# — M/L

### Strategic (team decision)
1. <move> — <trade-off> — <incremental path>

## Open questions

- <what could not be confirmed from the code, and what would settle it>

## Coverage

- **Read in depth:** <files>
- **Reviewed at convention level only:** <files/folders, and why>
- **Excluded:** <generated, vendored, build output>
- **Checked, not debt:** <scanner hits dropped after reading, with one-line reason>
````
