---
title: Liskov Substitution Principle (LSP)
impact: HIGH
tags:
  - solid
  - lsp
  - inheritance
---

## Rule

A subtype must be usable wherever its base type is expected without the
caller noticing. Report a violation when a subclass or implementation:

- throws `NotImplemented`/`UnsupportedOperation` or leaves an inherited
  method empty;
- requires stricter input (preconditions) or returns weaker results
  (postconditions) than the base;
- breaks the base's invariants (the classic `Square extends Rectangle`);
- forces callers to check the concrete type (`instanceof`, `type ===`)
  before calling a base method.

Search for these with `grep`: `throw new Error("not implemented")`,
`NotImplementedError`, `instanceof`, empty overrides `{}`/`pass`.

**Incorrect (code under review):**

```ts
class ReadOnlyRepo extends Repo {
  save() { throw new Error("read only") }
}
// callers: if (!(repo instanceof ReadOnlyRepo)) repo.save(x)
```

**Correct (recommended shape):**

```ts
interface Reader<T> { find(id: Id): Promise<T> }
interface Writer<T> { save(x: T): Promise<void> }
class ReadOnlyRepo implements Reader<Order> { /* ... */ }
```

**Why it matters:** LSP violations turn polymorphism into hidden
runtime errors and spread type checks through the callers.
