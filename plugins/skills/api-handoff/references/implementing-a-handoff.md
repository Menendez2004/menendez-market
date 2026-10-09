# Implementing a Handoff (Mode C)

Instructions for the receiving session. The handoff file is the
contract; the receiving codebase decides *how*, never *what*.

## 1. Validate and triage

```bash
python3 <skill-dir>/scripts/validate_handoff.py <file>.handoff.md
```

- Validator errors → stop, report them to the user (the author must fix
  the handoff). Do not guess around a broken contract.
- `status: draft` → read `## Open questions`. If a question's "blocks"
  names something on your side, ask before building that part. Build the
  rest.
- Check `receiver` matches your side (a `frontend` handoff implemented in
  the backend repo is the wrong session).

## 2. Read in this order

1. `## What the receiver must do` and **Out of scope** — the task list.
2. `## Conventions` — base URL, auth, casing, dates, money, error envelope.
3. Each `## Endpoint N`: Purpose → Request → Body → Responses → Errors →
   Behavior → Receiver notes → Acceptance criteria.
4. Then the receiving codebase: API client / HTTP layer, data-fetching
   library, how existing features handle errors and loading, DTO and
   validation style, test conventions.

## 3. Implement

### Frontend receiver

- Add one client function per endpoint in the existing API layer, typed
  with the request and response tables (reuse the `Receiver notes`
  types if given, adapted to the codebase's naming conventions for
  *type names* only — never for *field names*).
- Send exactly the documented headers (`Idempotency-Key` lifecycle as
  described).
- Implement every UI state: loading, success, empty, and one handling
  per row of `#### Errors`, as its `Receiver must` column says.
- If there is a mock layer (MSW, fixtures), add handlers that return the
  handoff's JSON examples, including the error envelopes.

### Backend receiver

- Route with the exact method and full path; DTO / schema with every
  field, type, required flag and rule from the body table.
- Return exactly the success shape and status; every error row with its
  status and `code` in the app's error envelope.
- Enforce the business, validation and authorization rules in
  `Receiver notes`; implement the side effects in `Behavior and side
  effects` (transactions, events, idempotency).
- Follow neighboring endpoints for structure (module, service, repository
  layers) and tests.

## 4. Verify against the contract

- For each acceptance criterion, point to the code path or test that
  satisfies it. Write tests the codebase's way where it has them.
- Backend: exercise the endpoint with the handoff's JSON examples
  (a request test, or `curl` against a local server if the user allows
  starting it) and compare the response to the documented example field
  by field.
- Frontend: if the backend is reachable in dev, compare a real response to
  the documented example; otherwise test against the mock built from the
  examples.

## 5. Report

```
### Handoff implemented: <title> (revision <n>)
**File:** <handoff path>
**Implemented:** <files changed>
**Acceptance criteria:** <met>/<total>
  - AC-1.1 met — <file or test>
  - AC-1.4 not met — <reason>
**Contract mismatches:** <none | where — handoff says X, observed Y (file:line or response)>
**Open questions still pending:** <none | Qn — what was built meanwhile>
```

Mismatches are never fixed by quietly following the code instead of the
handoff (or the other way round). Report them; the user decides which
side changes, and the author revises the handoff (Mode D).
