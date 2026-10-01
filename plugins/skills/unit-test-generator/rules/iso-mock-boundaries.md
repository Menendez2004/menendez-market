---
title: Mock only the unit's boundaries
impact: HIGH
tags:
  - testing
  - isolation
  - mocking
---

## Rule

Mock everything that crosses the unit's boundary and keep everything inside
it real.

| Mock | Keep real |
|---|---|
| Network / HTTP clients, external APIs | The unit under test itself — never mock it, partially or fully |
| Databases, ORMs, repositories, caches, queues | Pure functions and value objects the unit uses |
| File system, environment, clock, randomness | Data classes / DTOs (build them with factories) |
| Services from other modules | Private helpers in the same module |

Type every mock against the real interface (`vi.mocked`, `create_autospec`,
`Mock<T>`, `@Mock` on the interface) so a contract change breaks the test.
For HTTP boundaries, prefer the repo's request-level mocking (MSW, nock,
`responses`, `respx`, WireMock) if it already uses one.

**Incorrect:**

```python
def test_total_includes_tax(mocker):
    mocker.patch("billing.invoice.compute_tax", return_value=10)     # pure helper
    mocker.patch.object(Invoice, "total", return_value=110)          # the unit itself
    assert Invoice(items=build_items()).total() == 110
```

- Error: Mocks the method under test and a pure helper, so the test asserts
  its own mock.
- Cause: Mocking everything the unit touches instead of its boundaries.

**Correct:**

```python
def test_total_includes_tax(mocker):
    # Arrange
    rates = mocker.create_autospec(TaxRateGateway, instance=True)    # boundary
    rates.rate_for.return_value = Decimal("0.10")
    items = LineItemFactory.build_batch(3)
    invoice = Invoice(items=items, tax_rates=rates)

    # Act
    total = invoice.total()

    # Assert
    subtotal = sum(i.price * i.quantity for i in items)
    assert total == subtotal * Decimal("1.10")
```

**Why it matters:** Mocking the unit or its pure helpers makes the test
verify the mock, so it passes on broken code. Not mocking the boundaries
makes it slow, flaky and dependent on external systems.
