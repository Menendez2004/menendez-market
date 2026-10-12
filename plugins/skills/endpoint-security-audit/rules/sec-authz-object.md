---
title: Object-level authorization (BOLA / IDOR)
impact: CRITICAL
tags:
  - security
  - authorization
  - bola
  - idor
  - owasp-api1
---

## Rule

Every time a handler or the code it calls loads, updates or deletes a
record using an identifier from the request, confirm the query or a check
right after it restricts the record to the caller (owner, tenant,
organization, or an explicit permission). This includes nested IDs
(`/accounts/:accountId/cards/:cardId` — is the card in that account, and is
the account the caller's?) and IDs inside the body.

How to confirm in code:

- The lookup is `findById(req.params.id)` / `get(id)` / `WHERE id = ?` with
  no `userId`/`tenantId` condition, and no `if (record.ownerId !== user.id)`
  after it → finding.
- A check exists but runs after a side effect, compares the wrong field,
  or only applies to some methods (GET checked, PATCH/DELETE not).
- List endpoints filtered by a client-supplied `userId`/`tenantId` query
  param instead of the authenticated identity.
- Unguessable IDs (UUIDs) reduce discoverability; they are not
  authorization. Still a finding, severity may drop one level if IDs are
  never exposed to other users.

**Incorrect:**

```js
// routes/orders.js:14
router.get('/orders/:id', requireAuth, async (req, res) => {
  const order = await Order.findByPk(req.params.id);
  res.json(order);
});
```

- Error: Any logged-in user reads any order by changing the ID.

**Correct:**

```js
const order = await Order.findOne({ where: { id: req.params.id, userId: req.user.id } });
if (!order) return res.status(404).json({ error: 'Not found' });
```

**Why it matters:** BOLA is the most common API flaw (OWASP API1:2023,
CWE-639). It is trivial to exploit — increment a number — and exposes or
modifies every user's data.
