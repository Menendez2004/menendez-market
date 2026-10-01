---
title: Run only the tests you wrote, once
impact: HIGH
tags:
  - testing
  - verification
  - performance
---

## Rule

After writing the tests, run only the new or edited test file(s), once, with
the repo's own command (from `package.json` scripts, Makefile, `pyproject`,
CI config) and the project's package manager (`env-package-manager.md`).
Never run the full suite.

| Stack | Example single-file command |
|---|---|
| Vitest | `pnpm exec vitest run test/order-service.test.ts` (or `yarn vitest run …`, `bunx vitest run …`) |
| Jest | `pnpm exec jest test/order-service.test.ts` (or `yarn jest …`, `bunx jest …`) |
| pytest | `uv run pytest tests/test_pricing.py` (or `poetry run pytest …`, or `pytest …` in the active venv) |
| Go | `go test ./internal/pricing -run TestApplyDiscount` |
| JUnit (Maven / Gradle) | `mvn -Dtest=OrderServiceTest test` / `./gradlew test --tests OrderServiceTest` |
| .NET | `dotnet test --filter FullyQualifiedName~OrderServiceTests` |
| Rust | `cargo test --test order_service` or `cargo test order_service::` |

Prefer the repo's script (`pnpm test <file>`, `yarn test <file>`,
`bun run test <file>`) when it wraps the runner with required setup. Use the
npm form (`npx …`, `npm test -- <file>`) only when the project uses npm.

- If the run fails because of the test, fix the test and run that file again.
- If it fails because of the code, follow `verify-no-prod-changes.md`.
- If the brief or the user says not to run tests (for example when spawned
  by dev-orchestrator), do not run them; put the command in the report.
- Report the exact command and the pass/total count.

**Why it matters:** Running the generated file proves the tests compile,
the mocks are wired and the assertions hold. Running the full suite is slow
and belongs to the developer or CI.
