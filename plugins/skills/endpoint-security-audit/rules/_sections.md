# ENDPOINT SECURITY AUDIT — Section Definitions

## Sections

### std — Audit Standards
Impact: CRITICAL
Order: 1
How the audit is run: statically, read-only, following every input to
where it is used.

- `std-read-only.md` (CRITICAL)
- `std-trace-to-sink.md` (CRITICAL)

### sec — Security Checks
Impact: CRITICAL
Order: 2
What to look for at each route. Each rule names the pattern, how to
confirm it in code, and the fix.

- `sec-authn.md` (CRITICAL)
- `sec-authz-object.md` (CRITICAL)
- `sec-authz-function.md` (CRITICAL)
- `sec-injection.md` (CRITICAL)
- `sec-files.md` (CRITICAL)
- `sec-ssrf.md` (HIGH)
- `sec-mass-assignment.md` (HIGH)
- `sec-exposure.md` (HIGH)
- `sec-business-logic.md` (HIGH)
- `sec-resource.md` (MEDIUM)
- `sec-config.md` (MEDIUM)

### rpt — Reporting
Impact: CRITICAL
Order: 3
How findings are proven, scored and written.

- `rpt-evidence.md` (CRITICAL)
- `rpt-severity.md` (HIGH)

## Impact levels

- **CRITICAL** — violating this rule makes the audit miss exploitable
  flaws, report false ones, or cause harm.
- **HIGH** — violating this rule leaves a common class of flaw unchecked
  or makes findings hard to act on.
- **MEDIUM** — violating this rule weakens coverage of lower-risk issues.
- **LOW** — style and convention only.
