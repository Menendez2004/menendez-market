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

Start now (parallel): step 1 (writes src/auth/*, package.json),
                      step 4 (writes docs/*)
After 1:              step 2 (writes src/billing/*, package.json),
                      step 3 (needs step 1's function)

It shows this map to the Lead before the mandatory question, then launches
steps 1 and 4, and launches 2 and 3 the moment step 1 is Complete, without
waiting for step 4.
```

**Rules:**

- Before the mandatory pause, map every step's writes, reads, needs and
  shared hotspots (`references/parallelization.md`).
- Two steps run at the same time only if neither needs the other, their
  writes do not overlap, and they do not touch the same single-writer
  hotspot (lockfiles, manifests, migrations, generated/index files, global
  config). A step starts as soon as its `Needs` are Complete and it
  conflicts with nothing running; there is no wave barrier.
- Unknown footprint means sequential. When in doubt, sequential.
- Every Task Agent edits only its owned files; anything
  else is `Blocked` with `needs-file`, never a silent edit.
- Scheduling never changes the plan's content; the Lead approves the map.

**Why it matters:** Each Task Agent works in its own worktree
(`high-worktree-isolation.md`), but every finished step is applied as a
patch to the same Lead working tree. Two steps that write the same file
produce patches that conflict, and a step that starts before its `Needs`
are integrated builds on code that does not exist in its snapshot. Without
a dependency map, the fastest schedule is also the one most likely to
produce rejected patches and steps built on missing code. With worktrees
off, Task Agents share one working tree and this rule is the only
protection against overwritten edits.
