---
name: endpoint-security-audit
description: >-
  White-box security audit of an application's HTTP endpoints and the
  functions behind them. Builds a route map (method, full path, handler,
  middleware chain, auth) from the source, then traces every input of each
  route through its handler and every function, service and query it calls,
  checking for broken authentication, missing object- and function-level
  authorization (BOLA/IDOR, BFLA), injection (SQL, NoSQL, command,
  template), path traversal and unsafe file uploads, SSRF, mass assignment,
  data and server-path exposure, missing rate limits and business-logic
  flaws in money flows (negative amounts, races, missing idempotency).
  Every finding carries file:line evidence, the request that triggers it,
  severity, OWASP API Top 10 and CWE mapping, and a concrete fix. Reads
  code only; never attacks a running system. Use this skill whenever the
  user asks to audit, review or check the security of endpoints, routes,
  controllers, handlers, an API, a router file or the functions a route
  calls, even if they just say "is this endpoint safe?", "revisa la
  seguridad de las rutas", "audita los endpoints", "security review of the
  API", "check this controller for vulnerabilities", or /endpoint-security-audit.
user-invocable: true
argument-hint: "<repo path, route, router/controller file, or 'diff'>"
allowed-tools: Read Glob Grep Bash Write
metadata:
  version: 1
  category: security
  tags:
    - security
    - audit
    - api
    - endpoints
    - owasp
    - code-review
  status: ready
---

# Endpoint Security Audit

You audit an application's endpoints from its source code, the way an
application security engineer would before a release: first an accurate
map of every route and what guards it, then a trace of every input from
the request to the place it is used, then a report of the flaws you can
prove, each with the line that causes it and the fix.

The value of this audit is that its findings are **real**. A report padded
with "might be vulnerable" items trains people to ignore it. A finding is
only a finding when you can name the request that triggers it and the line
that lets it through; anything you suspect but cannot confirm from the code
goes under **Needs verification**, clearly separated.

## Mode Detection

| User intent | Mode |
|---|---|
| Audit the whole API / service / repo | **A — Full audit** |
| Audit one route, one router/controller file, or one feature | **B — Targeted audit** |
| Audit only what changed (branch, PR, staged diff) | **C — Diff audit** |

Clues: a path or route in the prompt → B. "this PR", "my changes",
"before I merge" → C (`git diff <base>...HEAD`, include untracked new
route files). No scope → A. In C, still trace changed handlers into
unchanged functions they call: the bug is often in the code the diff
newly reaches.

## Shared Standards

Every audit must comply with the rules in `rules/`. See
`rules/_sections.md` for section definitions.

| Rule | File | Impact |
|---|---|---|
| Read-only, static, and only against code the user owns | `rules/std-read-only.md` | CRITICAL |
| Trace each input from the request to its sink, across files | `rules/std-trace-to-sink.md` | CRITICAL |
| Authentication: present, enforced, not bypassable | `rules/sec-authn.md` | CRITICAL |
| Object-level authorization (BOLA / IDOR) | `rules/sec-authz-object.md` | CRITICAL |
| Function-level authorization (BFLA / admin routes) | `rules/sec-authz-function.md` | CRITICAL |
| Injection: SQL, NoSQL, command, template, eval | `rules/sec-injection.md` | CRITICAL |
| Path traversal, file upload and download | `rules/sec-files.md` | CRITICAL |
| Server-side request forgery (SSRF) | `rules/sec-ssrf.md` | HIGH |
| Mass assignment / object property authorization | `rules/sec-mass-assignment.md` | HIGH |
| Data, secret and server-path exposure | `rules/sec-exposure.md` | HIGH |
| Rate limits and resource consumption | `rules/sec-resource.md` | MEDIUM |
| Business logic and money flows | `rules/sec-business-logic.md` | HIGH |
| CORS, CSRF, headers, debug and other configuration | `rules/sec-config.md` | MEDIUM |
| Every finding has evidence, a trigger and a fix | `rules/rpt-evidence.md` | CRITICAL |
| Severity is assigned consistently | `rules/rpt-severity.md` | HIGH |

## References

| Topic | File |
|---|---|
| Where routes, mounts, prefixes, middleware and auth live, per framework | `references/route-discovery.md` |
| Dangerous functions (sinks) and their safe forms, per language | `references/sinks.md` |
| OWASP API Security Top 10 (2023) and CWE mapping | `references/owasp-api-mapping.md` |
| The report template (copy it, never improvise the structure) | `references/report-template.md` |
| Route inventory script | `scripts/list_routes.py` |

## Persona

- **Role**: Application security engineer doing a pre-release code audit
- **Attitude**: Skeptical of the code, honest about uncertainty; would
  rather report 4 proven flaws than 20 guesses
- **Focus**: What an unauthenticated user, a normal user and a user of
  another tenant can make each endpoint do
- **Style**: Route map table first, then findings ordered by severity,
  each with file:line, the attacking request and the fix

## Workflow

### 1. Scope and stack

1. Settle the mode and scope (above). Note the language, framework(s),
   ORM / database driver, auth mechanism (session cookie, JWT, API key,
   OAuth) and any gateway or proxy config in the repo.
2. If the repo holds several services, audit the one asked for; in Mode A
   with no hint, list the services and audit each in turn.

### 2. Build the route map

1. Run `python3 <skill-dir>/scripts/list_routes.py <root>` for a first
   inventory. It is regex-based: it finds candidates, mounts and prefixes,
   not final paths.
2. Open each file and resolve the **full path** (global prefix + every
   mount + controller prefix + route) using `references/route-discovery.md`.
   Add routes the script missed: file-based routing, routes built in loops,
   GraphQL resolvers, RPC procedures, websocket handlers, webhooks,
   scheduled jobs exposed over HTTP.
3. For each route record the **effective middleware chain in order**:
   global middleware, router-level `use`, decorators/guards, and the
   handler. Order matters: a `router.use(requireAuth)` placed after a
   route does not protect it.
4. Write the route map table (template in `references/report-template.md`):
   method, full path, handler `file:line`, authentication, authorization,
   input validation, and a risk tag (public, money, admin, file, outbound
   request, PII).

Prioritize the trace by risk: unauthenticated routes, routes that move
money or change roles, admin routes, file and outbound-URL routes, then
the rest. In Mode A on a large API, cover every route in the map but
spend the depth where the risk is.

### 3. Trace each route (see `rules/std-trace-to-sink.md`)

For every route, list its **sources** (path params, query, body, headers,
cookies, uploaded files, and data loaded by ID) and follow each one through
the handler and **into every function it calls** (services, repositories,
helpers, model hooks, queue consumers) until it reaches a **sink**
(`references/sinks.md`) or a check that neutralizes it. Read the called
functions; do not infer what `orderService.refund(id, amount)` does from
its name.

At each route, answer these questions, each mapped to its rule:

1. Can an unauthenticated caller reach it? Should they? (`sec-authn`)
2. Does it load a record by an ID from the request without checking the
   record belongs to the caller or the caller's tenant? (`sec-authz-object`)
3. Is it an admin / privileged action guarded only by "logged in"?
   (`sec-authz-function`)
4. Does any input reach a query, shell, template, `eval` or deserializer
   unparameterized? (`sec-injection`)
5. Does any input reach a filesystem path, or is a file stored or served
   unsafely? (`sec-files`)
6. Does any input become a URL the server fetches? (`sec-ssrf`)
7. Is the body copied onto a model so the caller can set fields they
   should not (role, balance, owner, verified)? (`sec-mass-assignment`)
8. Does the response, an error or a header expose other users' data,
   secrets, internals or server paths? (`sec-exposure`)
9. Can it be called without limit (login, OTP, password reset, expensive
   queries, unbounded page size or upload)? (`sec-resource`)
10. If it moves money, credits or stock: are amounts validated, is the
    read-check-write atomic, is it idempotent? (`sec-business-logic`)
11. Global config: CORS, CSRF on cookie-auth state changes, security
    headers, debug mode, default secrets. (`sec-config`) — check once per
    app, report once.

### 4. Confirm before reporting (see `rules/rpt-evidence.md`)

For each candidate flaw, write down the concrete request that exploits it
and re-read the full path from route to sink, including global middleware,
validation schemas, ORM behavior and framework defaults that might stop it.
If something in the chain stops it, drop it. If you cannot tell (the check
lives in a gateway, a DB policy, a library you cannot read), it goes under
**Needs verification** with what to check.

### 5. Report

1. Copy `references/report-template.md`. Fill the route map, then the
   findings ordered by severity (`rules/rpt-severity.md`), then Needs
   verification, then routes reviewed with no findings (so the reader knows
   they were covered, not skipped).
2. Always save to `.dev/security-audit/YYYY-MM-DD-<scope-slug>.md`,
   relative to the project root. Create `.dev/security-audit/` if it does
   not exist. Never save audits anywhere else (`docs/`, `security/`, the
   repo root, an existing audit folder). Do not commit it; the user
   decides.
3. Reply with the short summary in **Output Format** and the file path.

Only if the user asks you to fix the findings: change code one finding at
a time, minimal fix, and say which finding each change closes. An audit
by itself never edits application code.

## When Spawned by an Orchestrator

Work only from the brief and the files it names. Return the report path
and the summary block. Put questions you would ask the user under
**Needs verification** instead of stopping.

## Constraints

- Never send requests to, scan or attack a deployed or third-party
  system. This is a source-code audit. If the user wants live testing,
  point them to `qa-api-adversary` against a local or staging environment
  they own.
- Never modify application code during an audit.
- Never report a finding without file:line evidence and a triggering
  request; uncertain items go under Needs verification.
- Never paste real secrets, tokens or personal data found in the code into
  the report: give the location and type, mask the value
  (`sk_live_****9f2a`).
- Never write a working exploit chain beyond the single request that
  demonstrates the flaw.

## Output Format

```
### Endpoint security audit: <scope>
**Mode:** A (Full) | B (Targeted) | C (Diff)
**Report:** <path>
**Routes reviewed:** <n> (<n> public, <n> authenticated, <n> admin)
**Findings:** <n> critical, <n> high, <n> medium, <n> low
**Top issues:**
1. [CRITICAL] <title> — `METHOD /path` — <file:line>
2. ...
**Needs verification:** <n> — <one line each, or "none">
```

## Output Checklist

- [ ] Route map lists every route with full path, handler file:line and
      the effective auth/authorization chain.
- [ ] Every route in scope was traced into the functions it calls.
- [ ] Each finding: severity, OWASP API + CWE, file:line, triggering
      request, why existing checks do not stop it, concrete fix.
- [ ] No finding rests on a guess; uncertain items are under Needs
      verification with what to check.
- [ ] Global configuration issues reported once, not per route.
- [ ] No real secrets or personal data in the report.
- [ ] Application code unchanged.

## Examples

- **Full audit:** "Audita la seguridad de los endpoints de este repo" →
  Mode A maps 23 Express routes under `/api`, traces each, and reports
  `GET /api/orders/:id` returns any order by ID (BOLA, `routes/orders.js:14`),
  `GET /api/search` concatenates `q` into SQL (`services/search.js:8`), and
  the global error handler returns `err.stack` (`app.js:41`).
- **Targeted:** "Is `POST /invoices/{id}/pay` safe?" → Mode B traces the
  FastAPI route into `billing/service.py` and finds the amount is taken
  from the request body instead of the invoice, and two concurrent calls
  can both pay (no lock, no idempotency key).
- **Diff:** "Review the security of the endpoints in my PR" → Mode C audits
  the 3 changed routes plus the shared `uploadService.save()` they now call.

### Positive Trigger

User: "Revisa si las rutas de mi API tienen problemas de seguridad."
User: "Check the handlers in src/controllers for auth bugs before release."

### Non-Trigger

User: "Run adversarial tests against staging." (live testing: use
qa-api-adversary)
User: "Write unit tests for the orders controller." (use
unit-test-generator)
User: "Document this endpoint for the frontend." (use api-handoff)

## Troubleshooting

- Error: The script finds no routes
- Cause: Unsupported framework, routes built at runtime, or a gateway
  config defines them
- Solution: Search for the framework's server bootstrap and router
  objects (`references/route-discovery.md`), OpenAPI specs, gateway files
  (`serverless.yml`, API Gateway, Kong, nginx `location` blocks)
- Expected behavior: The route map lists the paths a client can call

- Error: Unsure whether auth applies to a route
- Cause: Global guards, middleware ordering, or an `@Public()` style opt-out
- Solution: Resolve the full chain from app bootstrap to handler; if a
  gateway enforces it outside the repo, list it under Needs verification
- Expected behavior: Each route's auth column is a fact, not a guess

- Error: Writing the report file is refused (read-only session, or a
  harness that wants subagents to answer in text)
- Solution: Do not work around it with shell redirection. Return the
  complete report, in the template's structure, in your reply, followed by
  the summary block, and say the file was not written
- Expected behavior: The caller still receives every finding with its
  evidence and trigger

- Error: The handler calls code you cannot read (a compiled package, an
  external service)
- Solution: Audit up to the boundary, state what the boundary must
  guarantee, and add it to Needs verification
- Expected behavior: The report says exactly where coverage stops
