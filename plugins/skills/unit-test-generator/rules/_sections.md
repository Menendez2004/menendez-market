# UNIT TEST GENERATOR — Section Definitions

## Sections

### env — Project Environment
Impact: HIGH
Order: 1
Rules for running commands in the project's own environment: its package
manager, scripts and lockfile.

- `env-package-manager.md` (HIGH)

### data — Test Data
Impact: CRITICAL
Order: 2
Rules for where test data and test doubles come from: the repo's factories and
fake-data library, never hand-written objects, and always deterministic.

- `data-no-manual-mocks.md` (CRITICAL)
- `data-reuse-repo-tooling.md` (CRITICAL)
- `data-deterministic.md` (HIGH)

### iso — Isolation
Impact: HIGH
Order: 3
Rules for keeping each test focused on one unit and independent of every
other test.

- `iso-mock-boundaries.md` (HIGH)
- `iso-no-shared-state.md` (HIGH)

### struct — Test Structure
Impact: HIGH
Order: 4
Rules for how each test is laid out, which cases a suite must contain, and
what it asserts.

- `struct-aaa.md` (HIGH)
- `struct-case-matrix.md` (HIGH)
- `struct-assert-behavior.md` (MEDIUM)

### verify — Verification
Impact: CRITICAL
Order: 5
Rules for running the generated tests and handling failures without touching
production code.

- `verify-no-prod-changes.md` (CRITICAL)
- `verify-run-scoped.md` (HIGH)

## Impact levels

- **CRITICAL** — violating this rule produces tests that lie (pass on broken
  code, or hide a bug) or changes code the user did not ask to change.
- **HIGH** — violating this rule produces flaky, brittle or incomplete tests
  that need rework.
- **MEDIUM** — violating this rule makes tests harder to maintain.
- **LOW** — style and convention only.
