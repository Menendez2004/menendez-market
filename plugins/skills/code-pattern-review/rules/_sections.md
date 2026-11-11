# CODE PATTERN REVIEW — Section Definitions

## Sections

### std — Review Standards
Impact: CRITICAL
Order: 1
How the review is run: read-only, and always against a stated pattern.

- `std-read-only.md` (CRITICAL)
- `std-expected-pattern.md` (CRITICAL)

### pat — Pattern Conformance
Impact: CRITICAL
Order: 2
Checking the expected pattern's conventions, and naming the actual
pattern when the code drifts from it.

- `pat-conventions.md` (CRITICAL)
- `pat-identify-actual.md` (HIGH)

### solid — SOLID Principles
Impact: HIGH
Order: 3
One rule per principle: how to spot a violation in code and when it is
worth reporting.

- `solid-srp.md` (HIGH)
- `solid-ocp.md` (MEDIUM)
- `solid-lsp.md` (HIGH)
- `solid-isp.md` (MEDIUM)
- `solid-dip.md` (HIGH)

### debt — Technical Debt
Impact: HIGH
Order: 4
Finding debt, measuring what it costs and ordering it.

- `debt-identify.md` (HIGH)
- `debt-prioritize.md` (HIGH)

### rpt — Reporting
Impact: CRITICAL
Order: 5
How findings are proven and how recommendations are written.

- `rpt-evidence.md` (CRITICAL)
- `rpt-recommendations.md` (HIGH)

## Impact levels

- **CRITICAL** — violating this rule makes the review wrong, unfair to the
  code, or harmful (edits code that was only meant to be reviewed).
- **HIGH** — violating this rule leaves a costly class of problem
  unreported or makes the review hard to act on.
- **MEDIUM** — violating this rule weakens coverage of lower-cost issues.
- **LOW** — style and convention only.
