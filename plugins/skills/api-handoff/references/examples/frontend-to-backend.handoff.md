---
handoff: api
title: Product reviews list
direction: frontend-to-backend
receiver: backend
status: draft
revision: 1
created: 2026-10-09
updated: 2026-10-09
author: Claude session for the frontend team
source:
  repo: acme/shop-web
  branch: feat/product-reviews
  commit: a81d03e
related:
  - https://design.example.com/file/product-page-reviews
endpoints:
  - id: EP1
    method: GET
    path: /api/v1/products/{productId}/reviews
    change: new
---

# Product reviews list — API handoff

## Summary

The product page gets a "Reviews" section with an average rating and an
infinite-scroll list of reviews. The frontend is built against a mock; the
backend needs to build one read endpoint that returns the rating summary
and a cursor-paginated list of reviews for a product.

## What the receiver must do

1. Build `GET /api/v1/products/{productId}/reviews` in the products module,
   following the conventions of the existing `GET /api/v1/products/{productId}`.
2. Return only published reviews, newest first unless Q1 decides otherwise.
3. Compute `summary` over all published reviews of the product, not only
   the current page.
4. Add the endpoint to the API docs the backend already generates.

**Out of scope:** creating, editing or moderating reviews.

## Conventions

| Item | Value |
|---|---|
| Base URL | `{API_BASE_URL}` |
| Auth | public (the product page is public) |
| Content type | `application/json; charset=utf-8` |
| Field casing | camelCase (same as `GET /api/v1/products/{productId}`) |
| Dates | ISO 8601 UTC strings |
| Money | not used |
| IDs | UUID v4 strings |
| Pagination | cursor: `?cursor=&limit=` in, `nextCursor` (string or null) out |

**Error envelope:** the API's existing envelope
`{ "error": { "code", "message", "details" } }`, as returned today by
`GET /api/v1/products/{productId}`.

## Endpoint 1 — GET /api/v1/products/{productId}/reviews

### Purpose

Lists a product's published reviews with a rating summary, for the
"Reviews" section of the product page (`src/features/product/ProductReviews.tsx`).

### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Path | `/api/v1/products/{productId}/reviews` |
| Auth | public |
| Idempotent | yes (read only) |
| Rate limit | TBD (Q3) |

#### Path parameters

| Name | Type | Description |
|---|---|---|
| `productId` | string (uuid) | product whose reviews are listed |

#### Query parameters

| Name | Type | Required | Default | Rules |
|---|---|---|---|---|
| `cursor` | string | no | none (first page) | opaque value from the previous `nextCursor` |
| `limit` | integer | no | `10` | 1–TBD (Q2) |

#### Headers

None.

#### Body

No body.

### Responses

#### Success

**`200 OK`**

| Field | Type | Nullable | Description |
|---|---|---|---|
| `summary.average` | number | yes | 1.0–5.0 rounded to 1 decimal; `null` when there are no reviews |
| `summary.count` | integer | no | published reviews of the product |
| `summary.distribution` | object | no | keys `"1"`–`"5"`, value = count of reviews with that rating |
| `items[].id` | string (uuid) | no | review id |
| `items[].rating` | integer | no | 1–5 |
| `items[].title` | string | yes | |
| `items[].body` | string | no | plain text, the frontend does not render HTML |
| `items[].authorName` | string | no | display name only, never email |
| `items[].createdAt` | string (datetime) | no | ISO 8601 UTC |
| `nextCursor` | string | yes | `null` on the last page |

```json
{
  "summary": {
    "average": 4.3,
    "count": 27,
    "distribution": { "1": 1, "2": 1, "3": 2, "4": 8, "5": 15 }
  },
  "items": [
    {
      "id": "c2d4e6f8-1a3b-4c5d-8e7f-9a0b1c2d3e4f",
      "rating": 5,
      "title": "Works great",
      "body": "Example review text.",
      "authorName": "Example User",
      "createdAt": "2026-10-01T18:22:00Z"
    }
  ],
  "nextCursor": "eyJvZmZzZXQiOjEwfQ"
}
```

#### Errors

| Status | `code` | When | Receiver must |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | `limit` out of range or malformed `cursor` | return the existing envelope with `details` |
| 404 | `PRODUCT_NOT_FOUND` | product does not exist or is unpublished | same code `GET /api/v1/products/{productId}` already returns |

### Behavior and side effects

None — read only. The frontend caches each page for 60 s; the backend may
add HTTP caching if it wants (Q3).

### Receiver notes

- Reuse the product lookup of `GET /api/v1/products/{productId}` so the
  404 behavior is identical.
- Order must be stable across pages (break ties by `id`) so infinite
  scroll never repeats or skips a review.
- `summary` is returned on every page; the frontend reads it only from
  the first page.

### Acceptance criteria

- [ ] AC-1.1 A product with 0 published reviews returns `200` with `summary.average: null`, `summary.count: 0`, all distribution values `0`, `items: []` and `nextCursor: null`.
- [ ] AC-1.2 Following `nextCursor` until it is `null` returns every published review exactly once.
- [ ] AC-1.3 Unpublished reviews never appear in `items` nor count in `summary`.
- [ ] AC-1.4 An unknown `productId` returns `404 PRODUCT_NOT_FOUND`.
- [ ] AC-1.5 `limit=0` or a malformed `cursor` returns `400 VALIDATION_ERROR`.

## Open questions

- **Q1** — Sort order: newest first only, or also "most helpful"? If a second order is added, the frontend will add `?sort=`. · decides: product · blocks: nothing (newest first is the default)
- **Q2** — Maximum `limit`. The frontend only sends `10`; suggest 50. · decides: backend · blocks: EP1 query parameters
- **Q3** — Rate limit / HTTP caching for this public endpoint. · decides: backend · blocks: nothing for the frontend

## Changelog

| Revision | Date | Change | Breaking for receiver |
|---|---|---|---|
| 1 | 2026-10-09 | Initial handoff | — |
