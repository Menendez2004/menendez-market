---
title: Interface Segregation Principle (ISP)
impact: MEDIUM
tags:
  - solid
  - isp
  - interfaces
---

## Rule

No client should depend on methods it does not use. Report a violation
when:

- implementers stub out methods they do not need (no-ops, `throw`,
  `return null`) to satisfy a wide interface;
- a function or component takes a large object (whole `User`, whole
  `props`, whole `config`) and uses one or two fields, which forces callers
  and tests to build the whole object;
- one "god interface" (`IRepository` with 25 methods, `AppContext`) is
  injected everywhere.

In TypeScript, prefer narrow parameter types (`Pick<User, "email">`, a
small interface) and split React contexts by concern.

**Incorrect (code under review):**

```ts
interface Worker { work(): void; eat(): void; payroll(): Money }
class Robot implements Worker { eat() {} payroll() { return 0 } }
```

**Correct (recommended shape):**

```ts
interface Workable { work(): void }
interface Payable { payroll(): Money }
class Robot implements Workable { work() {} }
```

**Why it matters:** Wide interfaces couple unrelated clients: a change to
one method forces recompiles, re-tests and stubs everywhere.
