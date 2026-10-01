---
title: Arrange, Act, Assert
impact: HIGH
tags:
  - testing
  - structure
  - readability
---

## Rule

Every test has three visible blocks, in order: **Arrange** (build data and
mocks), **Act** (one call to the unit), **Assert** (check the outcome).
Separate them with blank lines, or with `// Arrange` / `# Act` comments if
the repo does that. Use the repo's naming style (`describe`/`it`,
`test_<unit>_<behavior>`, `@DisplayName`, `t.Run`).

- One Act per test. A second call to the unit means a second test.
- No assertions inside Arrange and no setup inside Assert.
- Name the test after the behavior and condition, not the method:
  `"throws UserNotFound when the id does not exist"`, not `"test findById 2"`.
- For many inputs with the same shape, use the runner's table support
  (`it.each`, `@pytest.mark.parametrize`, `@ParameterizedTest`, Go table
  tests) instead of copying tests.

**Incorrect:**

```typescript
it("works", async () => {
  const u = userFactory.build();
  repo.findById.mockResolvedValue(u);
  expect(await service.get(u.id)).toEqual(u);
  repo.findById.mockResolvedValue(null);
  await expect(service.get(u.id)).rejects.toThrow();
});
```

- Error: Two behaviors, two Acts, and a name that says nothing.

**Correct:**

```typescript
it("returns the user when it exists", async () => {
  // Arrange
  const user = userFactory.build();
  repo.findById.mockResolvedValue(user);

  // Act
  const result = await service.get(user.id);

  // Assert
  expect(result).toEqual(user);
});

it("throws UserNotFoundError when the user does not exist", async () => {
  // Arrange
  const id = faker.string.uuid();
  repo.findById.mockResolvedValue(null);

  // Act
  const act = () => service.get(id);

  // Assert
  await expect(act).rejects.toThrow(UserNotFoundError);
});
```

**Why it matters:** When a test with one Act fails, its name tells you what
broke. A test with several Acts fails on the first and hides the rest.
