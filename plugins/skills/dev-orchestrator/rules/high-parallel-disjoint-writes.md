---
title: Run steps in parallel only when they are independent and their writes are disjoint
impact: HIGH
tags: [parallelism, scheduling, conflicts, task-agent]
---

**Incorrect (plan with 4 steps):**

```
To save time, the Orchestrator launches all 4 Task Agents at once. Steps 1
and 2 both add a dependency to package.json, and step 3 calls a function
that step 1 is still writing. Step 1's package.json edit is overwritten by
step 2, and step 3 invents its own version of the missing function.
```

Parallelism saved minutes and cost a rework of three steps.

**Correct (same plan):**

```
The Orchestrator builds a footprint per step (writes, reads, needs, shared
hotspots) with a read-only Research Sub-agent, then groups them:

Wave 1 (parallel): step 1 (writes src/auth/*, package.json),
                   step 4 (writes docs/*)
Wave 2 (parallel): step 2 (writes src/billing/*, package.json -> waits for 1),
                   step 3 (needs step 1's function)

It shows this map to the Lead before the mandatory question, then launches
wave 1 in two terminals and wave 2 only after both results are Complete.
```

**Rules:**

- Before the mandatory pause, map every step's writes, reads, needs and
  shared hotspots (`references/parallelization.md`).
- Two steps share a wave only if neither needs the other, their writes do
  not overlap, and they do not touch the same single-writer hotspot
  (lockfiles, manifests, migrations, generated/index files, global config).
- Unknown footprint means sequential. When in doubt, sequential.
- Every Task Agent in a parallel wave edits only its owned files; anything
  else is `Blocked` with `needs-file`, never a silent edit.
- Scheduling never changes the plan's content; the Lead approves the waves.

**Why it matters:** Parallel Task Agents share one working tree. Without a
dependency map, the fastest schedule is also the one most likely to produce
overwritten edits and steps built on code that does not exist yet.
