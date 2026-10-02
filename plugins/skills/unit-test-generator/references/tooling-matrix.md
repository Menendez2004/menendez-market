# Tooling Matrix

Use this table to map what you found in the repo to the right tools. Always
prefer what the repo already has; the "Default to propose" column is only
for asking the user when a category is missing
(`rules/data-reuse-repo-tooling.md`).

## JavaScript / TypeScript

| Need | Detect in repo | Default to propose |
|---|---|---|
| Package manager | `packageManager` field, then `pnpm-lock.yaml` / `yarn.lock` / `bun.lock(b)` / `package-lock.json` (`rules/env-package-manager.md`) | Ask; suggest pnpm. Never npm by default |
| Runner | `vitest`, `jest`, `mocha`, `node:test` in `package.json` | Vitest (Vite projects), Jest otherwise |
| Mocking | `vi.fn`/`vi.mock`, `jest.fn`/`jest.mock`, `sinon`, `ts-mockito`, `jest-mock-extended` | The runner's built-in mocks |
| HTTP mocking | `msw`, `nock` | MSW |
| Fake data | `@faker-js/faker` | `@faker-js/faker` |
| Factories | `fishery`, `@mswjs/data`, `rosie`, `factory.ts`, files named `*.factory.ts` | `fishery` (or plain typed builder functions on Faker) |
| Seed | `faker.seed(n)` | once per file, or in the runner's setup file |
| Time | `vi.useFakeTimers()` + `vi.setSystemTime(d)`, `jest.useFakeTimers()` | runner's fake timers |
| Coverage | `@vitest/coverage-v8` / `@vitest/coverage-istanbul`, Jest built-in `--coverage` | the Vitest provider matching the repo (`rules/verify-coverage-90.md`) |
| Reset | `clearMocks`/`mockReset`/`restoreMocks` in config | `afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); })` (Jest: `jest.clearAllMocks()` + `jest.restoreAllMocks()`); `restoreAllMocks()` alone does not clear call history |

## Python

| Need | Detect in repo | Default to propose |
|---|---|---|
| Environment / package manager | `uv.lock`, `poetry.lock`, `pdm.lock`, `Pipfile.lock` (`rules/env-package-manager.md`) | the one detected; ask if none |
| Runner | `pytest`, `unittest` | pytest |
| Coverage | `pytest-cov`, `coverage` | `pytest-cov` with `--cov-branch` |
| Mocking | `unittest.mock` (`patch`, `create_autospec`), `pytest-mock` (`mocker`) | `pytest-mock` with `create_autospec` |
| HTTP mocking | `responses`, `respx`, `requests-mock`, `pytest-httpx` | the one matching the HTTP client |
| Fake data | `Faker` (also the `faker` pytest fixture) | `Faker` |
| Factories | `factory_boy`, `polyfactory`, `model_bakery` (Django) | `factory_boy` (or `polyfactory` for Pydantic/dataclasses) |
| Seed | `Faker.seed(n)`, `faker_seed` fixture, `pytest-randomly` | `Faker.seed(n)` in `conftest.py` |
| Time | `freezegun`, `time-machine` | `time-machine` |

## Java / Kotlin

| Need | Detect in repo | Default to propose |
|---|---|---|
| Runner | JUnit 5 (`junit-jupiter`), JUnit 4, Kotest | JUnit 5 |
| Mocking | Mockito (`@Mock`, `@InjectMocks`), MockK | Mockito (MockK for Kotlin) |
| Fake data | Datafaker (`net.datafaker`), java-faker (legacy) | Datafaker |
| Object generation | Instancio, EasyRandom, test builders | Instancio |
| Seed | `new Faker(new Random(n))`, Instancio `@Seed` | per test class |
| Time | injected `java.time.Clock` (`Clock.fixed`) | `Clock.fixed(...)` |

## C# / .NET

| Need | Detect in repo | Default to propose |
|---|---|---|
| Runner | xUnit, NUnit, MSTest | xUnit |
| Mocking | Moq, NSubstitute, FakeItEasy | NSubstitute |
| Fake data | Bogus (`Faker<T>`) | Bogus |
| Object generation | AutoFixture | — |
| Seed | `Randomizer.Seed = new Random(n)`, `Faker<T>.UseSeed(n)` | `UseSeed` per faker |
| Time | `TimeProvider` / `FakeTimeProvider`, injected clock | `FakeTimeProvider` |

## Go

| Need | Detect in repo | Default to propose |
|---|---|---|
| Runner | `testing`, `testify` | `testing` + `testify/assert` if present |
| Mocking | `go.uber.org/mock` (gomock), `testify/mock`, `mockery` generated mocks | the generator the repo uses |
| Fake data | `gofakeit` | `gofakeit` |
| Seed | `gofakeit.New(seed)` | one faker per test |
| Structure | table-driven tests with `t.Run` | table-driven |

## Ruby / PHP / Rust

| Stack | Runner | Mocking | Fake data / factories |
|---|---|---|---|
| Ruby | RSpec, Minitest | `rspec-mocks`, Mocha | `faker`, `factory_bot` |
| PHP | PHPUnit, Pest | PHPUnit mocks, Mockery | `fakerphp/faker`, Laravel model factories |
| Rust | `cargo test` | `mockall` | `fake` crate (seed with `StdRng::seed_from_u64` + `fake_with_rng`) |
