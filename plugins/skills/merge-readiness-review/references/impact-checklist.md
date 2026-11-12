# Impact checklist — how to find the consumers of each kind of change

Search in the **merged tree** (the temp worktree after `merge --no-commit`)
or with `git grep <pattern> <target-sha>` plus the source's own additions.
Exclude `node_modules`, build output and vendored code; include tests (they
tell you which consumers are covered) and every app/package of a monorepo.

| Changed surface | How to find consumers | Easy to miss |
|---|---|---|
| Exported function / class / method | `git grep -n "\b<name>\b"`; imports of the module path; re-exports (`export * from`, `__init__.py`, barrel `index.ts`) | dynamic access (`obj[name]`), DI containers registered by string, mocks in tests that hide the break |
| Signature change (params, return type) | every call site; typecheck on the merged tree | JS callers without types; optional param reorders; positional booleans |
| Behavior change (same signature) | every call site; read how the result/exception is used | callers that relied on the old error, ordering, null vs. throw, units, timezone, rounding |
| Component props / hooks | JSX usages `<Name `, hook calls, storybook, snapshot tests | props spread from parent (`{...props}`), default props removed |
| HTTP route / handler | route string in clients (`fetch`, axios, generated SDKs), OpenAPI/GraphQL schema, e2e tests, other services in the repo, mobile apps | path params renamed, middleware order, auth change, CORS |
| Response / request shape | client code that reads the field; schema/typing files; serializers | arithmetic on a field turned string; enum values; nullable fields |
| DB table / column / index | ORM models, raw SQL (`git grep -n "<column>"`), migrations on target, seeds, reports, analytics jobs | views, triggers, other services sharing the DB |
| Migration | migrations already on target (same number/timestamp, order), model files, seeds | down migration; data on existing rows; long locks |
| Event / message / queue / job | publishers and subscribers by topic/name string; schedulers (cron) | messages already queued in old format; retries |
| Config key / env var / feature flag | `git grep` the key; `.env*`, config templates, CI, Docker/compose, Helm/K8s, Terraform | different defaults per env; flags read in the frontend |
| Shared constant / enum / type | usages; switch statements over the enum (exhaustiveness) | serialized values stored in DB or cache |
| CSS class / design token | templates, `className=`, other stylesheets | global selectors, theming |
| Script / CLI / Makefile target | CI workflows, docs, other scripts, git hooks | deploy pipelines outside the repo (Open question) |
| Dependency (add / bump / remove) | imports of the package; lockfile diff vs. target; peer deps | transitive major bumps; duplicate versions; postinstall scripts |
| File moved / renamed | imports of the old path; path strings (configs, globs, Dockerfile COPY, jest `moduleNameMapper`) | case-only renames on case-insensitive filesystems |

## Verifying a consumer

1. Find a test that exercises the consumer's flow (search the test tree
   for the consumer's module or the flow's entry point). If it ran and
   passed on the merged tree → **Verified by check**.
2. Otherwise read the call site and decide whether it is compatible with
   the new behavior → **Verified by reading** (say why) or a finding.
3. If neither is possible → **Unverified**, with what would confirm it.
