---
title: Reuse the repo's test tooling before adding anything
impact: CRITICAL
tags:
  - testing
  - tooling
  - dependencies
  - conventions
---

## Rule

Before writing a test, discover the runner, assertion style, mocking
library, fake-data library and factories the repo already uses (see the
Workflow in `SKILL.md`, step 1). Use exactly those. Never introduce a second
runner, mocking library or data library, and never add a dependency without
the user's explicit approval.

**Incorrect (repo uses Vitest and `fishery` factories):**

```typescript
import { jest } from "@jest/globals";           // second runner
import { faker } from "@faker-js/faker";

const order = { id: faker.string.uuid(), total: faker.number.int() };  // ignores orderFactory
```

- Error: Mixes Jest into a Vitest repo and rebuilds an object the repo
  already has a factory for.
- Cause: Wrote from habit without looking at existing tests.

**Correct:**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { orderFactory } from "../factories/order";

const order = orderFactory.build();
```

## When the tooling is missing

| Situation | Action |
|---|---|
| Factories exist for some models | Reuse them; add new factories in the same place and style for the rest |
| Fake-data library installed, no factories | Create typed factories on top of it in the repo's test helpers folder |
| No fake-data library at all | Stop and ask: "This repo has no fake-data library. May I add `<lib>` as a dev dependency?" (pick `<lib>` from `references/tooling-matrix.md`) |
| User declines | Ask how they want test data built; do not fall back to hand-written objects silently |

**Why it matters:** A test suite is shared infrastructure. A second mocking
style or data library doubles what every contributor has to learn, and an
unapproved dependency is a change the user did not ask for.
