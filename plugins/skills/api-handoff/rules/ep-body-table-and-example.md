---
title: "Request body: field table + example that match exactly"
impact: CRITICAL
tags:
  - handoff
  - request-body
  - json
---

## Rule

Every body is documented twice, and both must agree:

1. A table `| Field | Type | Required | Rules / description |` with one
   row per field. Nested fields use dot paths (`shippingAddress.city`);
   array items use `[]` (`items[].productId`); the array/object itself
   also gets a row (`items`, `shippingAddress`).
2. A ` ```json ` example that:
   - parses as strict JSON (no comments, no trailing commas, no `...`);
   - contains every required field;
   - contains no field that is not in the table;
   - uses values that satisfy the rules (an enum value from the list, a
     length within limits, a valid UUID shape);
   - uses placeholder data only (`sec-no-secrets.md`).

`Required` is `yes` or `no`. For optional fields say what happens when
omitted (default value, ignored, `null`). For `PATCH`, say whether
omitted fields are left unchanged and whether `null` clears a value.

The same table + example pair is used for the success response (with a
`Nullable` column instead of `Required`).

The validator checks parsing and the table ↔ example correspondence.

**Incorrect:**

```markdown
| `items` | array | yes | cart lines |

{ "items": [{ "productId": "...", "qty": 2 }], // lines
}
```

- Error: `qty` is not in the table, `items[].productId` and
  `items[].quantity` have no rows, the JSON has a comment and a trailing
  comma and does not parse.

**Correct:**

```markdown
| `items` | array | yes | 1–50 lines |
| `items[].productId` | string (uuid) | yes | product to buy |
| `items[].quantity` | integer | yes | 1–99 |

{ "items": [{ "productId": "3f6c1b2e-8a51-4c3e-9a7e-2b1d5f0c9e11", "quantity": 2 }] }
```

**Why it matters:** The receiver copies the example into code, mocks and
tests. If it disagrees with the table, half of them follow one and half
follow the other.
