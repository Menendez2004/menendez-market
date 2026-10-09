# API HANDOFF — Section Definitions

## Sections

### src — Source of Truth
Impact: CRITICAL
Order: 1
Rules for where every value in a handoff comes from: the code, or an
explicit decision. Never memory, never a plausible guess.

- `src-code-is-truth.md` (CRITICAL)
- `src-no-invention.md` (CRITICAL)

### doc — Document Shape
Impact: CRITICAL
Order: 2
Rules that make a handoff readable by a session with zero context and
parseable by the validator.

- `doc-fixed-template.md` (CRITICAL)
- `doc-self-contained.md` (HIGH)

### ep — Endpoint Contract
Impact: CRITICAL
Order: 3
Rules for what each endpoint block must specify so the receiver can build
or consume it without asking.

- `ep-complete-contract.md` (CRITICAL)
- `ep-body-table-and-example.md` (CRITICAL)
- `ep-error-contract.md` (HIGH)
- `ep-acceptance-criteria.md` (HIGH)

### sec — Security
Impact: CRITICAL
Order: 4
Rules for keeping credentials and personal data out of handoffs, which
get pasted into tickets, chats and other sessions.

- `sec-no-secrets.md` (CRITICAL)

### impl — Implementing a Handoff
Impact: CRITICAL
Order: 5
Rules for the receiving session (Mode C).

- `impl-follow-contract.md` (CRITICAL)

### verify — Verification
Impact: HIGH
Order: 6
Rules for checking a handoff before it is handed over or implemented.

- `verify-validate.md` (HIGH)

## Impact levels

- **CRITICAL** — violating this rule makes the receiver build the wrong
  thing (a contract that does not match the other side) or leaks secrets.
- **HIGH** — violating this rule forces the receiver to come back with
  questions or to guess.
- **MEDIUM** — violating this rule makes the handoff harder to read or
  maintain.
- **LOW** — style and convention only.
