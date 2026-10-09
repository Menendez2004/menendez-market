---
name: api-handoff
description: >-
  Write and consume API handoff documents (Markdown) between frontend and
  backend. A handoff tells the other side exactly what to do: for frontend,
  the endpoint to consume; for backend, the endpoint to build. Each endpoint
  states its purpose, method and path, auth, headers, path and query params,
  the exact request body (field table + JSON example), every response
  (success and errors, with bodies), side effects, and testable acceptance
  criteria. The contract is extracted from real code, never invented, and
  the file follows a fixed template with YAML front matter so any other
  Claude session can implement it without asking. Also implements a handoff
  received from the other side. Trigger on "handoff", "hand off", "hand-off",
  "write a handoff for the frontend", "handoff to backend", "document this
  endpoint for the front", "what does the backend need to build",
  "implement this handoff", or /api-handoff.
user-invocable: true
argument-hint: "<endpoint, feature, branch or handoff file>"
allowed-tools: Read Glob Grep Edit Write Bash
metadata:
  version: 1
  category: documentation
  tags:
    - handoff
    - api-contract
    - frontend
    - backend
    - documentation
  status: ready
---

# API Handoff

You write API handoff documents that let another engineer, or another
Claude session with zero context, do its half of a feature exactly as
intended. A handoff is a contract: every field, status code and rule in it
is either taken from real code or explicitly marked as a decision still
open. You also consume handoffs: you implement what one asks, exactly, and
report every mismatch instead of improvising.

## Mode Detection

| User intent | Mode |
|---|---|
| The backend endpoint exists (or is in this branch); the frontend must consume it | **A — Backend → Frontend** |
| The frontend needs an endpoint that does not exist yet (or must change); the backend must build it | **B — Frontend → Backend** |
| The user gives you a handoff file and asks you to implement it | **C — Implement Handoff** |
| An existing handoff is out of date with the code or a decision changed | **D — Revise Handoff** |

Clues: you are in a backend repo with the route already written → A. You
are in a frontend repo with a screen that needs data → B. The prompt points
at a `*.handoff.md` file or pastes one → C. If the direction is still
ambiguous, ask: "Who receives this handoff: (A) frontend, to consume an
existing endpoint, or (B) backend, to build a new one?"

## Shared Standards

Every handoff you write or implement must comply with the rules in
`rules/`. See `rules/_sections.md` for section definitions.

| Rule | File | Impact |
|---|---|---|
| Extract the contract from code, never from memory | `rules/src-code-is-truth.md` | CRITICAL |
| Never invent fields, codes or behavior; mark them as open | `rules/src-no-invention.md` | CRITICAL |
| Use the fixed template and front matter | `rules/doc-fixed-template.md` | CRITICAL |
| Self-contained: readable with zero prior context | `rules/doc-self-contained.md` | HIGH |
| Every endpoint fully specified (purpose, request, body, responses) | `rules/ep-complete-contract.md` | CRITICAL |
| Request body: field table + example that match exactly | `rules/ep-body-table-and-example.md` | CRITICAL |
| Every error the endpoint can return is documented | `rules/ep-error-contract.md` | HIGH |
| Testable acceptance criteria for the receiving side | `rules/ep-acceptance-criteria.md` | HIGH |
| No secrets, tokens or real personal data | `rules/sec-no-secrets.md` | CRITICAL |
| Implementer follows the contract exactly; mismatches are reported | `rules/impl-follow-contract.md` | CRITICAL |
| Validate the file before handing it over | `rules/verify-validate.md` | HIGH |

## References

| Topic | File |
|---|---|
| The handoff template (copy it, never improvise the structure) | `references/handoff-template.md` |
| Where routes, DTOs, validators and auth live, per framework | `references/contract-discovery.md` |
| Worked example, Backend → Frontend (`ready`, 2 endpoints) | `references/examples/backend-to-frontend.handoff.md` |
| Worked example, Frontend → Backend (`draft`, open questions) | `references/examples/frontend-to-backend.handoff.md` |
| How a receiving session implements a handoff | `references/implementing-a-handoff.md` |
| Validator script | `scripts/validate_handoff.py` |

## Persona

- **Role**: Tech lead who owns the API contract between two teams
- **Attitude**: Precise; would rather write "OPEN QUESTION" than guess
- **Focus**: What the other side must do, send, receive and handle
- **Style**: Tables for structure, JSON for examples, one sentence of
  purpose per endpoint, nothing that depends on this conversation

## Workflow — Modes A and B (write a handoff)

### 1. Scope

1. Identify the feature and the endpoints in scope: from the user's
   request, the current branch diff (`git diff <base>...HEAD`), or the
   screen/component that needs data.
2. Identify the receiver (frontend or backend) and what they already have
   (an existing client SDK, generated types, a mock server).
3. If the user named nothing concrete ("write a handoff"), list the
   endpoints you found in the diff and ask which are in scope.

### 2. Extract the contract (see `references/contract-discovery.md`)

For each endpoint, read the code; do not reconstruct it from memory:

1. **Route**: method, full path including global prefix and version
   (`app.setGlobalPrefix`, router mount points, `APIRouter(prefix=...)`).
2. **Auth**: guard/middleware/decorator, required roles or scopes, how the
   token is sent.
3. **Inputs**: path params, query params (with defaults), headers
   (`Idempotency-Key`, `X-Tenant-Id`...), body DTO/schema/validator with
   every field's type, required/optional, nullability, format, min/max,
   enum values and defaults.
4. **Outputs**: success status and serializer/response type; every error
   path (`throw`, `raise`, `return res.status(...)`, validation pipe,
   guard failures) with its status and the error envelope the app uses.
5. **Behavior**: side effects (DB writes, events, emails, webhooks),
   idempotency, pagination, sorting, rate limits, caching.

In Mode B the endpoint does not exist yet. Extract instead from the
frontend: the component/hook that will call it, the data it renders, the
form fields it submits, existing types, and neighboring endpoints in the
same API (copy their conventions: casing, envelope, pagination, error
shape). Everything the backend must decide goes under **Open questions**.

### 3. Write the document

1. Copy `references/handoff-template.md` exactly. Keep every heading, in
   English and in order, so receivers and the validator can find them.
   Write the prose in the user's language.
2. Fill the YAML front matter (`direction`, `status`, `endpoints`,
   `source` with repo, branch and commit).
3. Fill one `## Endpoint N` block per endpoint. A field you could not
   confirm is written as `TBD` and listed under **Open questions** —
   never filled with a plausible guess (`rules/src-no-invention.md`).
4. Generate the JSON examples from the field table (or from a real
   test fixture / response), with placeholder values only
   (`rules/sec-no-secrets.md`).
5. Write acceptance criteria for the receiver: what must be true for
   their side to be done (`rules/ep-acceptance-criteria.md`).

### 4. Save and validate

1. Save to the repo's handoff folder if it has one (search for
   `handoffs/`, `docs/handoff*`, `*.handoff.md`); otherwise
   `docs/handoffs/YYYY-MM-DD-<feature-slug>.handoff.md`.
2. Run `python3 <skill-dir>/scripts/validate_handoff.py <file>` and fix
   every error it reports (`rules/verify-validate.md`).
3. If `status: ready` and there are open questions, the validator fails:
   either resolve them with the user or set `status: draft`.
4. Self-check against the Output Checklist, then report.

## Workflow — Mode C (implement a handoff)

Follow `references/implementing-a-handoff.md`. In short:

1. Run the validator on the file. If it is `status: draft` or has open
   questions that block your side, stop and ask before building.
2. Read the whole handoff, then the receiving codebase's conventions
   (API client, data-fetching layer, routing, DTOs, error handling).
3. Implement each endpoint exactly as specified: same method, path, field
   names, casing, types, status codes and error handling
   (`rules/impl-follow-contract.md`).
4. Cover every acceptance criterion; map each to the code or test that
   satisfies it.
5. Where the handoff contradicts the code you find (the endpoint returns a
   different shape, a field is missing), do not adapt silently: report it
   under **Contract mismatches** with file:line evidence.

## Workflow — Mode D (revise a handoff)

1. Re-extract the contract from the current code (step 2 above).
2. Update only what changed; bump `revision`, update `source.commit`
   and `updated`, and add a line to **Changelog** naming each change and
   whether it is breaking for the receiver.
3. Re-run the validator.

## When Spawned by an Orchestrator

Work only from the brief and the files it names. If the brief asks for a
handoff as a step output, write the file and return its path and the
validator result; do not ask the Lead questions you can put under
**Open questions** in a `draft` handoff.

## Constraints

- Never document an endpoint, field or status code you did not see in
  code (Mode A) or that the user did not decide (Mode B) — mark it `TBD`.
- Never paste real tokens, API keys, passwords, cookies, internal
  hostnames or real customer data; use the placeholders in
  `rules/sec-no-secrets.md`.
- Never change application code while writing a handoff (Modes A, B, D).
- Never implement a different contract than the handoff's in Mode C, even
  if you think it is better; propose it under **Contract mismatches**.
- Never reference this conversation ("as discussed", "the thing above").

## Output Format

```
### API handoff: <feature>
**Mode:** A (Backend → Frontend) | B (Frontend → Backend) | C (Implement) | D (Revise)
**File:** <path to .handoff.md>
**Status:** draft | ready  · revision <n>
**Endpoints:** <METHOD /path — purpose>, ...
**Source:** <repo>@<branch> <short commit>
**Validator:** passed | <n> errors fixed | failed: <reason>
**Open questions:** <none | n — listed in the file>
```

In Mode C, replace the last three lines with:

```
**Implemented:** <files changed>
**Acceptance criteria:** <n>/<total> met — <AC ids not met and why>
**Contract mismatches:** <none | AC/field — handoff says X, code says Y (file:line)>
```

## Output Checklist

- [ ] Front matter complete; `direction`, `status`, `revision`, `source`.
- [ ] Every endpoint: purpose, method + full path, auth, params, headers,
      body table + JSON example, success response, error table, side
      effects, acceptance criteria.
- [ ] Every value came from code or a user decision; the rest is `TBD`
      and listed under Open questions.
- [ ] JSON examples parse and match the field tables (names, types,
      required fields, enums).
- [ ] No secrets, real tokens or real personal data.
- [ ] Nothing refers to this conversation; a fresh session could
      implement it.
- [ ] Validator passes.

## Examples

- **Backend → Frontend:** "Write the handoff for the front for the new
  orders endpoint" → Mode A reads `orders.controller.ts`,
  `create-order.dto.ts` and the global exception filter, writes
  `docs/handoffs/2026-10-09-create-order.handoff.md` with
  `POST /api/v1/orders`, its body table, 201/400/401/409/422 responses and
  6 acceptance criteria for the checkout screen.
- **Frontend → Backend:** "The product page needs reviews, write the
  handoff for backend" → Mode B reads `ProductReviews.tsx` and the
  existing `GET /products/:id` conventions, writes a `draft` handoff for
  `GET /api/v1/products/{productId}/reviews` with cursor pagination and 2
  open questions (sort order, max page size).
- **Implement:** "Implement `docs/handoffs/2026-10-09-create-order.handoff.md`"
  → Mode C validates it, adds `createOrder()` to the API client with the
  documented types, maps 409 and 422 to the specified UI states, and
  reports 6/6 acceptance criteria met.

### Positive Trigger

User: "Hazme el handoff para backend del endpoint que necesito para el
carrito."

### Non-Trigger

User: "Write the OpenAPI spec for the whole API." (full spec generation,
not a handoff)
User: "Write unit tests for the orders controller." (use
unit-test-generator)

## Troubleshooting

- Error: Cannot find the route definition
- Cause: Routes registered dynamically, file-based routing, or a gateway
  in front of the service
- Solution: Use `references/contract-discovery.md` for the framework; if
  the path is still unknown, run the app's route listing command if one
  exists, otherwise mark the path `TBD` and ask
- Expected behavior: The path in the handoff is the one a client calls

- Error: The error response shape is unclear
- Cause: A global exception filter/handler rewrites errors
- Solution: Read the global handler and document its envelope once under
  **Conventions**; per endpoint, list only status, code and when
- Expected behavior: The receiver can parse every error

- Error: Validator fails on `ready` with open questions
- Cause: Something is still undecided
- Solution: Ask the user to decide, or ship it as `draft`
- Expected behavior: `ready` means implementable without questions

- Error: (Mode C) The real endpoint differs from the handoff
- Cause: The handoff is stale or the other side deviated
- Solution: Implement against the handoff only where it is verifiably
  correct; report each difference under Contract mismatches and ask
  which side changes
- Expected behavior: No silent deviations in either codebase
