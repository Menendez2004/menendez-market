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
- Reset mocks after each test (`vi.restoreAllMocks()`,
  `jest.restoreAllMocks()`, `mocker` auto-cleanup, `Mockito` per-test
  instances, `t.Cleanup` in Go), or enable the runner's `restoreMocks` /
  `clearMocks` option if the repo uses it.
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
  vi.restoreAllMocks();
});
```

**Why it matters:** Shared state makes tests pass or fail depending on order,
which shows up as flakiness in CI and as "works on my machine" locally.
