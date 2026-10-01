---
title: Assert behavior, not implementation
impact: MEDIUM
tags:
  - testing
  - assertions
  - maintainability
---

## Rule

Assert what a caller of the unit can observe: the return value, the thrown
error, the state it exposes, and the collaborator calls that are part of its
contract. Do not assert private methods, internal call order, intermediate
variables or how many times a pure helper ran.

- Prefer precise assertions (`toEqual(expected)`, `toThrow(ErrorType)`,
  `assert result == expected`) over vague ones (`toBeTruthy`, `not None`).
- Snapshot tests only when the repo already uses them for that kind of
  output, never as a substitute for real assertions.
- Assert collaborator calls with their meaningful arguments
  (`toHaveBeenCalledWith(expect.objectContaining({ email: user.email }))`),
  not with every incidental field.

**Incorrect:**

```typescript
expect(service["normalize"]).toHaveBeenCalled();       // private detail
expect(result).toBeTruthy();                           // passes for any object
```

**Correct:**

```typescript
expect(result).toEqual({ id: user.id, email: user.email.toLowerCase() });
expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ email: user.email.toLowerCase() }));
```

**Why it matters:** Tests tied to implementation break on every refactor that
keeps behavior identical, and vague assertions pass on wrong results.
