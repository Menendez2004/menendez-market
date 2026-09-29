# Dependency map and parallel waves

Goal: run as many Task Agents at the same time as is safe, to save time,
without two agents editing the same code and without starting a step before
the steps it depends on are done.

This is **scheduling, not replanning**: the Orchestrator never changes, splits
or reorders the steps' content (`rules/high-adopt-lead-plan.md`). It only
decides which steps can run together.

## 1. Build a footprint per step

For every plan step, before the mandatory pause, record:

| Field | What it is | How to get it |
| --- | --- | --- |
| **Writes** | Files/directories the step will create, edit or delete | Step text + a Research Sub-agent (graphify first if available) |
| **Reads** | Files, APIs, types, schemas the step relies on | Same |
| **Needs** | Earlier steps whose output this step uses (a new function, type, table, endpoint, config key, package) | Step text, then Writes/Reads overlap |
| **Shared resources** | Single-writer hotspots it touches (see list below) | Writes |

In single-session mode the Orchestrator may run these Research Sub-agents
itself; in multi-agent mode it does so before launching anything.

Be conservative: if a step's footprint cannot be pinned down (e.g. "refactor
wherever needed"), mark its Writes as `unknown`.

### Single-writer hotspots

Treat these as conflicting whenever two steps touch them, even if they edit
"different parts":

- dependency manifests and lockfiles (`package.json`, `package-lock.json`,
  `pnpm-lock.yaml`, `poetry.lock`, `go.mod`/`go.sum`, `Cargo.lock`, ...),
- database migrations and schema files (ordering/numbering collides),
- generated code and barrel/index files (`index.ts` re-exports, routers,
  DI registries),
- global config (`tsconfig`, lint/format config, `.env*`, CI files),
- shared type or API contract files that several steps extend.

## 2. Classify each pair of steps

Two steps **A** and **B** are:

- **Co-dependent** (must be sequential) if any of:
  - B `Needs` A's output, or A `Needs` B's;
  - their `Writes` overlap (same file, or one writes a directory the other
    writes into);
  - one `Writes` what the other `Reads` in a way that changes behavior
    (signature, schema, contract);
  - both touch the same single-writer hotspot;
  - either has `Writes: unknown`;
  - the Lead's plan says they are ordered ("after", "then", "once X is done").
- **Independent** (can run at the same time) only if none of the above holds.

When in doubt, treat them as co-dependent. A lost parallel slot costs
minutes; a merge conflict between two agents costs a rework.

## 3. Group steps into waves

Topologically sort the steps by `Needs`, then pack them greedily:

1. Wave 1 = all steps with no unmet `Needs`, as long as every pair inside
   the wave is independent. If two of them conflict, keep the lower-numbered
   one in this wave and push the other to a later wave.
2. Each later wave = steps whose `Needs` are all in earlier waves, same
   pairwise check.
3. Cap a wave at a reasonable number of terminals (default 4) unless the
   Lead says otherwise; overflow goes to the next wave.

Steps inside a wave run in parallel. A wave starts only when every step of
the previous wave has a `Complete` result.

## 4. Show it to the Lead in the mandatory pause

Before the mandatory question, show the dependency map:

```
Wave 1 (parallel): step 1 auth-model, step 3 email-templates
Wave 2 (parallel): step 2 auth-routes (needs 1), step 4 docs (needs 3)
Wave 3:            step 5 wire-up (needs 2, 4; touches package.json)

Co-dependent: 1->2 (routes use User model), 3->4, 2+4->5; 1 and 5 both edit package.json
```

Then ask the mandatory question verbatim. If the Lead chooses multi-agent,
the waves shown are the schedule; the Lead may instead ask for strictly
sequential execution, or move steps between waves.

Record the map in the scratchpad's `## Dependency Map` section.

## 5. During execution

- Each Task Agent's brief lists its **owned files** (its `Writes`) and the
  steps running in parallel with it.
- A Task Agent that discovers it must edit a file outside its owned files
  stops, marks the step `Blocked` with `needs-file: <path>` in its result
  file, and does not edit it. The Orchestrator then either waits for the
  conflicting parallel step to finish and relaunches, or moves the step to
  a later wave, and logs it in the scratchpad.
- Result files of a finished wave are merged into the scratchpad before the
  next wave's briefs are written, so later steps see the new state.
- Final checks still run once, after the last wave
  (`rules/high-checks-not-tests.md`).
