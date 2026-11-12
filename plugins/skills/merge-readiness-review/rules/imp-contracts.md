---
title: Contracts — API, schema and migrations, config/env, events, dependencies
impact: HIGH
tags:
  - contracts
  - migrations
  - dependencies
---

## Rule

When the diff touches one of these, check the specific risks below on the
merged tree and report each as a finding or as "checked, compatible".

- **HTTP/GraphQL/RPC API**: removed or renamed fields, type changes,
  new required request fields, status codes, error shapes, pagination,
  auth changes. Backward compatible for clients already deployed?
- **DB schema / migrations**: order relative to migrations already on the
  target (number/timestamp collisions), runs on existing data (NOT NULL
  without default, unique on duplicated data, long locks on big tables),
  reversible (`down`), the ORM model/schema file matches the migration,
  code deployed before the migration still works (expand → migrate →
  contract).
- **Config / env / feature flags**: new required keys present in every
  env example/template, CI and deploy config the repo contains; defaults
  safe; renamed keys still read under the old name or migrated.
- **Events / messages / jobs / cache**: payload shape changes for
  consumers and for messages already queued; cache keys or serialized
  formats that old entries still use.
- **Dependencies**: manifest and lockfile both updated and consistent
  with the target's lockfile; major bumps (read the changelog's breaking
  changes against the repo's usage); duplicate versions; license; new
  dependency where the target already has an equivalent (ponytail).
- **Public library exports** (packages consumed by others): semver-
  relevant changes are noted.

**Incorrect:**

```markdown
Migration looks fine.
```

**Correct:**

```markdown
- C1 [HIGH] `db/migrations/20261110_add_coupon_code.sql:3` adds `coupon_code NOT NULL` with no default;
  `orders` has rows on every environment → the migration fails. Add a default or backfill first.
- C2 [MEDIUM] new env `COUPONS_API_URL` read at `coupons/client.ts:5`; missing from `.env.example` and
  `deploy/helm/values.yaml` (present on target). Add it with a safe default.
```

**Why it matters:** Contracts break in places a test suite rarely
covers: other deployed clients, existing data, other environments.
