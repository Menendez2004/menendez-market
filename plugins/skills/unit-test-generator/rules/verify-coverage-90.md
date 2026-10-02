---
title: At least 90% coverage on the unit under test
impact: CRITICAL
tags:
  - testing
  - coverage
  - verification
---

## Rule

Every unit this skill tests must reach **at least 90%** coverage in each
metric the tool reports — **lines, statements, branches and functions** —
measured on the source file(s) of the unit under test, not on the whole
repo. If the repo already enforces a higher threshold, the higher one wins.

1. Run the generated test file(s) with coverage scoped to the unit's source
   file(s) and the 90% thresholds (commands below), through the project's
   package manager (`env-package-manager.md`).
2. If any metric is below 90%, read the uncovered lines and branches in the
   report, add tests for the behavior they represent (following the case
   matrix), and run the same scoped command again.
3. Repeat until every metric is at or above 90%.
4. Report the final numbers per metric.

**Never reach the number by gaming it:**

- No coverage-ignore markers (`/* istanbul ignore */`, `/* v8 ignore */`,
  `# pragma: no cover`, `[ExcludeFromCodeCoverage]`, `//nolint`-style
  exclusions) and no narrowing of the repo's coverage `include`/`exclude`.
- No tests without meaningful assertions that only execute lines.
- No changes to production code to remove branches
  (`verify-no-prod-changes.md`).

## Commands

| Stack | Scoped coverage with 90% thresholds |
|---|---|
| Vitest (needs `@vitest/coverage-v8` or `@vitest/coverage-istanbul`) | `pnpm exec vitest run <test> --coverage --coverage.include=<src> --coverage.thresholds.lines=90 --coverage.thresholds.branches=90 --coverage.thresholds.functions=90 --coverage.thresholds.statements=90` |
| Jest | `pnpm exec jest <test> --coverage --collectCoverageFrom=<src> --coverageThreshold='{"global":{"lines":90,"branches":90,"functions":90,"statements":90}}'` |
| pytest (needs `pytest-cov`) | `uv run pytest <test> --cov=<module.path> --cov-branch --cov-report=term-missing --cov-fail-under=90` |
| Go | `go test ./<pkg> -run <TestName> -coverprofile=cover.out && go tool cover -func=cover.out` (statement coverage; read the rows for the unit's functions) |
| JUnit + JaCoCo | `mvn -Dtest=<TestClass> test jacoco:report` (or `./gradlew test --tests <TestClass> jacocoTestReport`); read the class row in the report |
| .NET + coverlet | `dotnet test --filter FullyQualifiedName~<TestClass> /p:CollectCoverage=true /p:Include="[<Assembly>]<Namespace.Class>" /p:Threshold=90` |
| Rust (`cargo-llvm-cov`) | `cargo llvm-cov --test <name> --fail-under-lines 90`; read the file row for branches and functions |

Replace `pnpm exec` / `uv run` with the project's package manager (`yarn`,
`bunx`, `poetry run`…). Where the tool has no per-file threshold flag, read
the unit's row in the report and apply the 90% rule yourself. pytest-cov's
`--cov-fail-under` checks one combined line+branch number; also read the
per-file `Missing` column.

## When 90% is not reachable

| Situation | Action |
|---|---|
| Coverage tool not installed | Ask to add it as a dev dependency with the project's package manager (e.g. `pnpm add -D @vitest/coverage-v8`, `uv add --dev pytest-cov`) |
| Remaining lines are unreachable without changing production code (dead code, defensive branches with no seam) | Stop, report the coverage per metric, list each uncovered `file:line` with why it cannot be reached, suggest the minimal production change, and ask the user how to proceed. Do not report the task as done |
| Tests may not be run (orchestrator brief) | Report `Coverage: not measured (tests not run)` and include the scoped coverage command so the Lead can run it |

**Incorrect:**

```
Run: pnpm exec vitest run test/order-service.test.ts → 6/6 passed
(coverage not checked)
```

```typescript
/* v8 ignore next 3 */
if (!order.items.length) {
  throw new EmptyOrderError(order.id);
}
```

- Error: Coverage never measured, then hidden with an ignore marker instead
  of testing the empty-order branch.

**Correct:**

```
Run: pnpm exec vitest run test/order-service.test.ts --coverage --coverage.include=src/orders/order-service.ts --coverage.thresholds.lines=90 ...
  first run:  branches 75% (3/4) — uncovered: order-service.ts:12 (empty order)
  added:      "throws EmptyOrderError when the order has no items"
  second run: statements 100% · branches 100% · functions 100% · lines 100%
```

**Why it matters:** 90% is the team's floor for every unit. Measuring it
scoped to the unit shows exactly which behaviors are untested; measuring the
whole repo, or hiding lines from the report, hides them.
