---
title: Single Responsibility Principle (SRP)
impact: HIGH
tags:
  - solid
  - srp
  - cohesion
---

## Rule

A module should have **one reason to change**: it answers to one actor
or one concern. Report a violation when a class, module or function mixes
concerns that change for different reasons, typically business rules +
persistence + presentation + transport + integration.

Signals to check (confirm by reading, not by size alone):

- Methods that touch unrelated collaborators (DB, HTTP client, mailer,
  PDF renderer) in the same class.
- Names with "And", or vague names: `Manager`, `Helper`, `Utils`,
  `Processor`, `Handler` with dozens of methods.
- `git log` shows the file changed in commits about unrelated features.
- Tests for it need many unrelated mocks.
- A React component that fetches, transforms, validates and renders.

Do not report SRP for small cohesive modules just because they have
several methods. Report it when the mixing has a cost: merge conflicts,
changes rippling, tests that are hard to write.

**Incorrect (code under review):**

```ts
class InvoiceService {
  total(i: Invoice) { /* tax rules */ }
  save(i: Invoice) { return db.query("INSERT ...") }
  toPdf(i: Invoice) { /* layout */ }
  email(i: Invoice) { return smtp.send(/* ... */) }
}
```

**Correct (recommended shape):**

```ts
class InvoiceCalculator { total(i: Invoice) { /* tax rules */ } }
class InvoiceRepository { save(i: Invoice) { /* ... */ } }
class InvoicePdfRenderer { render(i: Invoice) { /* ... */ } }
class InvoiceMailer { send(i: Invoice, pdf: Buffer) { /* ... */ } }
```

**Why it matters:** Mixed responsibilities make every change risky:
a layout tweak to the PDF redeploys and retests the tax rules.
