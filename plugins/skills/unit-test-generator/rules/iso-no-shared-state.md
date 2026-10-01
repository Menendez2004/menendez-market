---
title: Reset mocks and state between tests
impact: HIGH
tags:
  - testing
  - isolation
  - lifecycle
---

## Rule

Every test builds its own data and mocks, and leaves nothing behind.

- Create mocks and data inside the test or in `beforeEach` / function-scoped
  fixtures, never in module-level mutable variables shared across tests.
- Clear mock call history after each test, and restore spies:
  - Vitest / Jest: `vi.clearAllMocks()` / `jest.clearAllMocks()` (or
    `resetAllMocks()` to also drop `mockReturnValue`/`mockImplementation`),
    plus `restoreAllMocks()` when the file uses `spyOn`. `restoreAllMocks()`
    alone only restores spies: it does **not** clear the calls recorded on
    `vi.fn()` / `jest.fn()` or on `vi.mock` / `jest.mock` module mocks, so
    `toHaveBeenCalledTimes` leaks from one test to the next.
  - Or rely on the runner config (`clearMocks` / `mockReset` /
    `restoreMocks`) when the repo sets it. Check the config before assuming
    a default: Vitest's default for `clearMocks` changed across versions.
  - Python: `mocker` (pytest-mock) and `patch` as context manager or
    decorator undo themselves; Mockito: fresh mocks per test
    (`@ExtendWith(MockitoExtension.class)`); Go: `t.Cleanup`.
- Restore fake timers, environment variables and patched globals.
- Tests must pass in any order and in isolation (`-t`, `-k`, `--grep`).

**Incorrect:**

```typescript
const repo = { save: vi.fn() };                   // shared across tests
const user = userFactory.build();                 // mutated by one test

it("saves the user", async () => { await service.register(user); expect(repo.save).toHaveBeenCalledTimes(1); });
it("normalizes the email", async () => { user.email = user.email.toUpperCase(); /* ... */ });
```

- Error: `repo.save` call count and the `user` object leak between tests.
- Cause: Module-level mutable fixtures.

**Correct:**

```typescript
// import { type Mock } from "vitest";
let repo: { save: Mock<UserRepo["save"]> };
let service: UserService;

beforeEach(() => {
  repo = { save: vi.fn() };
  service = new UserService(repo);
});

afterEach(() => {
  vi.clearAllMocks();     // drop recorded calls, including vi.mock module mocks
  vi.restoreAllMocks();   // restore any vi.spyOn spies
});
```

**Why it matters:** Shared state makes tests pass or fail depending on order,
which shows up as flakiness in CI and as "works on my machine" locally.
