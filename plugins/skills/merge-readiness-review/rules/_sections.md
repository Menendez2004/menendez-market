# MERGE READINESS REVIEW — Section Definitions

## Sections

### std — Review Standards
Impact: CRITICAL
Order: 1
What the review is judged against, how it stays isolated from the user's
branches, and the strict ponytail rule.

- `std-target-branch.md` (CRITICAL)
- `std-isolation.md` (CRITICAL)
- `std-ponytail.md` (CRITICAL)

### mrg — Merge Correctness
Impact: CRITICAL
Order: 2
Whether the merge applies and whether the merged tree still builds and
passes its checks, compared with the target alone.

- `mrg-conflicts.md` (CRITICAL)
- `mrg-checks-baseline.md` (CRITICAL)

### imp — Impact on Other Flows
Impact: CRITICAL
Order: 3
Everything outside the diff that calls into what the diff changes.

- `imp-blast-radius.md` (CRITICAL)
- `imp-contracts.md` (HIGH)
- `imp-endpoints-to-check.md` (HIGH)

### rpt — Reporting
Impact: CRITICAL
Order: 4
How findings are proven and how the verdict is decided.

- `rpt-evidence-verdict.md` (CRITICAL)

## Impact levels

- **CRITICAL** — violating this rule makes the verdict wrong (a broken
  merge called ready, or a fine one blocked), or changes the user's
  branches during a review.
- **HIGH** — violating this rule leaves a class of breakage unexamined.
- **MEDIUM** — violating this rule weakens coverage of lower-cost issues.
- **LOW** — style and convention only.
