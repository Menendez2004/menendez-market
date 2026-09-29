---
title: Research Sub-agents are strictly read-only and check graphify first
impact: CRITICAL
tags: [research-subagent, read-only, graphify]
---

**Incorrect (Research Sub-agent "helps" while investigating):**

```
Research Sub-agent asked "why does the orders test fail?" reads the logs,
spots a typo in orders.service.ts, fixes it with Edit, reruns the tests, and
reports "fixed". It also ran `graphify .`, which created graphify-out/ in the
repo.
```

The Task Agent's context now disagrees with the working tree, the change
bypassed the step's scope, and the repo gained untracked files nobody asked
for.

**Correct (same question):**

```
Research Sub-agent checks for graphify-out/ -> found. Queries the graph for
modules depending on orders.service.ts, then reads the failing test and the
log. Replies:

- Cause: orders.service.ts:42 calls `totl` (typo) -> TypeError in test log.
- Dependents (graphify): checkout.controller.ts, invoices.job.ts.
- graphify: used (existing graph).
- No changes made.

The Task Agent applies the fix itself.
```

**Rules:**

- No `Edit`/`Write`, no file creation or deletion, no state-changing shell
  commands, no git mutations, no package installs, no test runs.
- Before manual search or bulk reading, check for graphify
  (`references/graphify.md`); if present, use it first. Never build or
  rebuild a graph inside the project.
- Return a short synthesis and end. No spawning, no talking to the Lead.

**Why it matters:** Research Sub-agents exist to keep exploration out of the
Task Agent's context. The moment they write, there are two uncoordinated
writers in one step and the Task Agent is reasoning about a tree it did not
change. Graphify-first makes the investigation fast; read-only keeps it safe.
