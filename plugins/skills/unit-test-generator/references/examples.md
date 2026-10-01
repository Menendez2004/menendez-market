# Worked Examples

## TypeScript — Vitest + Faker + fishery

Unit under test:

```typescript
// src/users/user-service.ts
export class UserService {
  constructor(private repo: UserRepo, private mailer: Mailer) {}

  async register(input: { email: string; name: string }): Promise<User> {
    if (!input.email.includes("@")) throw new InvalidEmailError(input.email);
    const existing = await this.repo.findByEmail(input.email.toLowerCase());
    if (existing) throw new EmailTakenError(input.email);
    const user = await this.repo.save({ ...input, email: input.email.toLowerCase() });
    await this.mailer.sendWelcome(user.email);
    return user;
  }
}
```

Factory (reused by every test that needs a user):

```typescript
// test/factories/user.ts
import { Factory } from "fishery";
import { faker } from "@faker-js/faker";
import type { User } from "../../src/users/user";

export const userFactory = Factory.define<User>(() => ({
  id: faker.string.uuid(),
  email: faker.internet.email().toLowerCase(),
  name: faker.person.fullName(),
  createdAt: faker.date.past(),
}));
```

Test file:

```typescript
// test/users/user-service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { faker } from "@faker-js/faker";
import { userFactory } from "../factories/user";
import { UserService } from "../../src/users/user-service";
import { InvalidEmailError, EmailTakenError } from "../../src/users/errors";
import type { UserRepo } from "../../src/users/user-repo";
import type { Mailer } from "../../src/mail/mailer";

faker.seed(20261001);

describe("UserService.register", () => {
  let repo: { findByEmail: Mock<UserRepo["findByEmail"]>; save: Mock<UserRepo["save"]> };
  let mailer: { sendWelcome: Mock<Mailer["sendWelcome"]> };
  let service: UserService;

  beforeEach(() => {
    repo = { findByEmail: vi.fn(), save: vi.fn() };
    mailer = { sendWelcome: vi.fn() };
    service = new UserService(repo as unknown as UserRepo, mailer as unknown as Mailer);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("saves the user with a lowercased email and sends a welcome mail", async () => {
    // Arrange
    const saved = userFactory.build();
    const input = { email: saved.email.toUpperCase(), name: saved.name };
    repo.findByEmail.mockResolvedValue(null);
    repo.save.mockResolvedValue(saved);

    // Act
    const result = await service.register(input);

    // Assert
    expect(result).toEqual(saved);
    expect(repo.save).toHaveBeenCalledWith({ ...input, email: saved.email });
    expect(mailer.sendWelcome).toHaveBeenCalledWith(saved.email);
  });

  it.each(["", "not-an-email"])("throws InvalidEmailError for %j", async (email) => {
    // Arrange
    const input = { email, name: faker.person.fullName() };

    // Act
    const act = () => service.register(input);

    // Assert
    await expect(act).rejects.toThrow(InvalidEmailError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("throws EmailTakenError and sends no mail when the email exists", async () => {
    // Arrange
    const existing = userFactory.build();
    repo.findByEmail.mockResolvedValue(existing);

    // Act
    const act = () => service.register({ email: existing.email, name: existing.name });

    // Assert
    await expect(act).rejects.toThrow(EmailTakenError);
    expect(repo.save).not.toHaveBeenCalled();
    expect(mailer.sendWelcome).not.toHaveBeenCalled();
  });

  it("propagates repository failures without sending mail", async () => {
    // Arrange
    const input = { email: faker.internet.email(), name: faker.person.fullName() };
    const failure = new Error(faker.lorem.sentence());
    repo.findByEmail.mockResolvedValue(null);
    repo.save.mockRejectedValue(failure);

    // Act
    const act = () => service.register(input);

    // Assert
    await expect(act).rejects.toBe(failure);
    expect(mailer.sendWelcome).not.toHaveBeenCalled();
  });
});
```

Literals here (`""`, `"not-an-email"`) are the invalid inputs under test;
all other data comes from Faker or the factory.

## Python — pytest + pytest-mock + factory_boy

Unit under test:

```python
# billing/discount.py
def apply_discount(order: Order, code: str, codes: DiscountCodeRepo, now: datetime) -> Order:
    discount = codes.get(code)
    if discount is None:
        raise UnknownCodeError(code)
    if discount.expires_at < now:
        raise ExpiredCodeError(code)
    total = max(order.total - discount.amount, Decimal("0"))
    return replace(order, total=total)
```

Factories:

```python
# tests/factories.py
from datetime import timezone
import factory
from billing.models import Order, DiscountCode

class OrderFactory(factory.Factory):
    class Meta:
        model = Order
    id = factory.Faker("uuid4")
    total = factory.Faker("pydecimal", left_digits=3, right_digits=2, positive=True)

class DiscountCodeFactory(factory.Factory):
    class Meta:
        model = DiscountCode
    code = factory.Faker("bothify", text="????-####")
    amount = factory.Faker("pydecimal", left_digits=2, right_digits=2, positive=True)
    expires_at = factory.Faker("future_datetime", tzinfo=timezone.utc)
```

Seed in `tests/conftest.py`:

```python
from faker import Faker
import factory.random

Faker.seed(20261001)
factory.random.reseed_random(20261001)
```

Tests:

```python
# tests/test_discount.py
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from billing.discount import apply_discount, UnknownCodeError, ExpiredCodeError
from billing.repos import DiscountCodeRepo
from tests.factories import OrderFactory, DiscountCodeFactory

NOW = datetime(2026, 10, 1, tzinfo=timezone.utc)  # pinned clock: the unit takes `now` as input


@pytest.fixture
def codes(mocker):
    return mocker.create_autospec(DiscountCodeRepo, instance=True)


def test_subtracts_the_discount_from_the_total(codes):
    # Arrange
    order = OrderFactory.build(total=Decimal("100.00"))
    discount = DiscountCodeFactory.build(amount=Decimal("15.00"), expires_at=NOW + timedelta(days=1))
    codes.get.return_value = discount

    # Act
    result = apply_discount(order, discount.code, codes, NOW)

    # Assert
    assert result.total == order.total - discount.amount


def test_clamps_the_total_to_zero_when_the_discount_exceeds_it(codes):
    # Arrange
    order = OrderFactory.build(total=Decimal("10.00"))
    discount = DiscountCodeFactory.build(amount=Decimal("25.00"), expires_at=NOW + timedelta(days=1))
    codes.get.return_value = discount

    # Act
    result = apply_discount(order, discount.code, codes, NOW)

    # Assert
    assert result.total == Decimal("0")


def test_raises_unknown_code_error_when_the_code_does_not_exist(codes):
    # Arrange
    order = OrderFactory.build()
    unknown_code = DiscountCodeFactory.build().code
    codes.get.return_value = None

    # Act / Assert
    with pytest.raises(UnknownCodeError):
        apply_discount(order, unknown_code, codes, NOW)


@pytest.mark.parametrize("expires_delta", [timedelta(seconds=-1), timedelta(days=-30)])
def test_raises_expired_code_error_for_expired_codes(codes, expires_delta):
    # Arrange
    order = OrderFactory.build()
    discount = DiscountCodeFactory.build(expires_at=NOW + expires_delta)
    codes.get.return_value = discount

    # Act / Assert
    with pytest.raises(ExpiredCodeError):
        apply_discount(order, discount.code, codes, NOW)
```

The pinned amounts (`100.00`, `15.00`, `10.00`, `25.00`) are the boundary
values that select each branch; every other field is fake.
