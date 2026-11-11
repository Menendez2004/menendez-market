---
title: Dependency Inversion Principle (DIP)
impact: HIGH
tags:
  - solid
  - dip
  - coupling
  - testability
---

## Rule

High-level policy (business rules, use cases) must not depend on
low-level details (DB drivers, ORMs, HTTP clients, SDKs, file system,
clock); both depend on abstractions owned by the high-level side.

Signals to check:

- `new ConcreteClient()`, `new PrismaClient()`, `axios.create()` or a
  singleton import (`import db from "../db"`) inside services or domain
  code.
- Domain/use-case files importing framework, ORM or SDK packages.
- Tests that need a real database, network or `jest.mock` of a module
  path because there is no seam to inject a fake.
- Direct use of `Date.now()`/`Math.random()`/env vars in business rules
  that then become hard to test.

Do not demand an interface for every class. Report DIP when the concrete
dependency crosses a boundary the pattern cares about (domain → infra)
or blocks testing.

**Incorrect (code under review):**

```ts
export class OrderService {
  private db = new PostgresClient(process.env.DB_URL!);
  create(o: Order) { return this.db.insert("orders", o) }
}
```

**Correct (recommended shape):**

```ts
export interface OrderRepository { save(o: Order): Promise<void> }
export class OrderService {
  constructor(private readonly orders: OrderRepository) {}
  create(o: Order) { return this.orders.save(o) }
}
```

**Why it matters:** Concrete dependencies in business code lock it to one
database or vendor and make every test an integration test.
