---
title: Mass assignment / object property authorization
impact: HIGH
tags:
  - security
  - mass-assignment
  - owasp-api3
---

## Rule

When a request body is copied onto a model or into an update query, confirm
only the fields the caller may change are accepted. Look for sensitive
properties in the model: `role`, `isAdmin`, `permissions`, `balance`,
`credit`, `price`, `status`, `verified`, `emailVerified`, `ownerId`,
`userId`, `tenantId`, `plan`, `createdAt`.

Confirmed when:

- `Model.create(req.body)`, `Object.assign(user, req.body)`,
  `{...req.body}` into `update`, `user.update(req.body)`,
  `Model(**request.json)`, `serializer` with `fields = '__all__'`,
  Rails `params.permit!`, Laravel `$guarded = []`, Spring binding an entity
  directly from `@RequestBody`
- and no allowlist / DTO with `whitelist: true` / explicit field pick sits
  between the body and the write.

Also check the read side (excessive data exposure, same OWASP item):
returning the full model (`res.json(user)`) when it holds `passwordHash`,
tokens, internal flags or other users' data.

**Incorrect:**

```js
// routes/users.js:22
router.patch('/users/me', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.user.id);
  Object.assign(user, req.body);
  await user.save();
  res.json(user);
});
```

- Error: `{"role":"admin"}` makes the caller an admin; the response also
  returns `passwordHash`.

**Correct:**

```js
const { name, avatarUrl } = updateProfileSchema.parse(req.body);
await user.update({ name, avatarUrl });
res.json({ id: user.id, name: user.name, avatarUrl: user.avatarUrl });
```

**Why it matters:** One extra JSON field escalates privileges or rewrites a
balance (OWASP API3:2023, CWE-915, CWE-213).
