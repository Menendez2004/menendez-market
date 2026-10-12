---
title: Business logic and money flows
impact: HIGH
tags:
  - security
  - business-logic
  - fintech
  - race-condition
  - owasp-api6
---

## Rule

For routes that move money, credits, points, stock, or change state in a
workflow (orders, transfers, refunds, payouts, coupons, subscriptions,
approvals), check the logic, not just the plumbing.

Check:

- **Amounts and quantities** from the client: negative, zero, fractional
  where integers are expected, huge, `NaN`, strings. A transfer of `-100`
  moves money the other way. Prices or totals must come from the server
  (catalog, invoice), never the request body.
- **Currency**: floats for money (`0.1 + 0.2`); currency taken from the
  client and not matched to the account.
- **Races (TOCTOU)**: read balance → check → write, with no transaction,
  row lock (`SELECT ... FOR UPDATE`), atomic update
  (`UPDATE ... SET balance = balance - $1 WHERE id = $2 AND balance >= $1`)
  or unique constraint. Two parallel requests both pass the check.
- **Idempotency**: payment, transfer and order-create endpoints without an
  idempotency key or unique constraint, so retries charge twice.
- **Workflow steps**: skipping a step (paying an order still in `draft`,
  shipping before payment), reusing one-time things (coupon, reset token,
  invite) because "used" is not set atomically.
- **Self-dealing**: transferring to self, refunding more than paid,
  approving one's own request.

**Incorrect:**

```js
// services/wallet.js:15
const from = await Wallet.findByPk(fromId);
if (from.balance < amount) throw new Error('Insufficient funds');
from.balance -= amount; to.balance += amount;
await from.save(); await to.save();
```

- Error: `amount` can be negative; two concurrent transfers both pass the
  balance check; no transaction, so a crash between saves loses money.

**Correct:**

```js
if (!Number.isInteger(amount) || amount <= 0) throw new BadRequest();
await sequelize.transaction(async (t) => {
  const [n] = await Wallet.update(
    { balance: sequelize.literal(`balance - ${amount}`) },
    { where: { id: fromId, ownerId: user.id, balance: { [Op.gte]: amount } }, transaction: t });
  if (n === 0) throw new BadRequest('Insufficient funds');
  await Wallet.increment('balance', { by: amount, where: { id: toId }, transaction: t });
});
```

(`amount` is a validated integer here, which is what makes the literal
safe; otherwise use a bound parameter.)

**Why it matters:** These flaws pass every input-validation check and still
lose money (OWASP API6:2023, CWE-840, CWE-362, CWE-20).
