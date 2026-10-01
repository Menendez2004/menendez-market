---
title: Seeded, deterministic data and time
impact: HIGH
tags:
  - testing
  - determinism
  - flaky-tests
  - faker
---

## Rule

Random data must be reproducible and time must be controlled:

- Seed the fake-data library once per test file (or rely on the repo's
  global seeding, such as `pytest-randomly` or a shared setup file).
- Never let the result of an assertion depend on a random value you did not
  pin: if the branch depends on the value, override it in the factory.
- Freeze or fake the clock (`vi.useFakeTimers` + `vi.setSystemTime`,
  `jest.useFakeTimers`, `freezegun`, `time-machine`, an injected `Clock`)
  whenever the unit reads the current time.
- Mock other sources of nondeterminism the unit uses (UUID generation,
  `Math.random`, environment variables).

**Incorrect:**

```typescript
const user = userFactory.build();                  // age is random
expect(canBuyAlcohol(user)).toBe(true);            // fails whenever age < 18
```

- Error: The outcome depends on an unpinned random field.
- Cause: The factory's random value decides which branch runs.

**Correct:**

```typescript
faker.seed(20261001);                              // once per file

it("allows adults to buy alcohol", () => {
  // Arrange
  const adult = userFactory.build({ age: 18 });

  // Act
  const allowed = canBuyAlcohol(adult);

  // Assert
  expect(allowed).toBe(true);
});
```

- The field that selects the branch is pinned; everything else stays fake.
- The seed makes any failure reproducible on the next run.

**Why it matters:** Unseeded random data and real clocks create tests that
fail once a week and pass on retry, and nobody can reproduce them.
