---
title: Extract the contract from code, never from memory
impact: CRITICAL
tags:
  - handoff
  - api-contract
  - accuracy
---

## Rule

Every method, path, field, type, constraint, status code and error code in
a handoff must be read from the code that defines it, in the current
branch:

- **Path**: the route decorator/registration **plus** every prefix that
  applies (global prefix, router mount, versioning, controller prefix).
- **Body and query**: the DTO / schema / validator the framework actually
  runs (class-validator DTO, Zod/Joi/Yup schema, Pydantic model, serializer,
  FormRequest, `@Valid` bean), not the TypeScript interface someone wrote
  next to it.
- **Responses**: the serializer / response model / return type, and the
  status the handler or framework sets (NestJS `POST` defaults to `201`,
  FastAPI uses `status_code=`, Express whatever `res.status()` says).
- **Errors**: every `throw`/`raise`/early `return` in the handler and the
  services it calls, the validation pipe, auth guards, and the global error
  handler that shapes the envelope.

In Mode B (the endpoint does not exist yet) the source of truth is the
frontend code that will call it plus the backend conventions of
neighboring endpoints; anything neither defines is a decision, not a fact
(see `src-no-invention.md`).

Record `source.repo`, `source.branch` and `source.commit` so the receiver
knows which version of the code the contract describes.

**Incorrect:**

```markdown
| `quantity` | number | yes | positive |
```

- Error: Written from the feature description; the DTO says
  `@IsInt() @Min(1) @Max(99)`.
- Cause: The author did not open the DTO.

**Correct:**

```markdown
| `quantity` | integer | yes | 1–99 |
```

- Copied from `create-order.dto.ts` (`@IsInt() @Min(1) @Max(99)`).

**Why it matters:** The receiver trusts the handoff over their own
guesses. One wrong limit or path prefix ships a frontend that gets `400`
or `404` in production, and nobody notices until a user does.
