---
title: No hand-written test data or hand-rolled fakes
impact: CRITICAL
tags:
  - testing
  - test-data
  - faker
  - factories
  - mocking
---

## Rule

Domain objects, payloads and records used as test data come from the repo's
factories or its fake-data library (Faker, factory_boy, Bogus, Datafaker,
gofakeit…). Test doubles for collaborators come from the repo's mocking
framework (`vi.fn`/`vi.mock`, `jest.fn`/`jest.mock`, `unittest.mock`,
`pytest-mock`, Mockito, Moq, NSubstitute, gomock, mockall…). Never write
dummy objects, fixture JSON or fake classes by hand.

**Incorrect:**

```typescript
const fakeUser = { id: "123-abc", email: "test@example.com", createdAt: "2026-01-01" };

class FakeUserRepo {            // hand-rolled fake
  async findById() { return fakeUser; }
}
```

- Error: Data is hand-written and a fake class duplicates the repository
  interface by hand.
- Cause: Quicker to type than to find or build a factory.

**Correct:**

```typescript
import { faker } from "@faker-js/faker";
import { userFactory } from "../factories/user";      // reuse or create once
import type { UserRepo } from "../../src/users/user-repo";

const user = userFactory.build();                      // Faker-backed, typed
const repo = { findById: vi.fn<UserRepo["findById"]>().mockResolvedValue(user) };
```

- Data comes from one typed factory that every test reuses.
- The collaborator is a framework mock typed against the real interface, so
  a signature change breaks the test at compile time.

## Allowed literals

A literal is allowed only when the literal itself is the case under test:

| Allowed | Example |
|---|---|
| Boundary and invalid inputs | `""`, `0`, `-1`, `Number.MAX_SAFE_INTEGER`, `null`, `"not-an-email"` |
| Enum / status values | `OrderStatus.Cancelled`, `"PENDING"` |
| Error codes and messages the unit defines | `"USER_NOT_FOUND"`, `404` |
| Overrides that pin the field the test is about | `userFactory.build({ age: 17 })` |

Everything else in the object still comes from the factory. Expected values
are derived from the arranged data (`expect(result.email).toBe(user.email)`),
not repeated as new literals.

**Why it matters:** Hand-written data hides assumptions (every user is
"John", every id is `1`), drifts from the real model, and is copied between
tests until a schema change breaks dozens of files. Hand-rolled fakes drift
from the interface they replace and silently keep passing.
