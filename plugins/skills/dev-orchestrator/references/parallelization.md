# Dependency map and scheduling

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

The Orchestrator runs this research itself, before the mandatory pause, in
both modes. It uses the graph from `references/graphify.md` section 0 when
there is one.

**Research all steps at once.** Launch one Research Sub-agent per step (or
per group of up to 3 small steps), all in a **single message** with several
`Agent` calls, so they run in parallel instead of one after another. Each
brief asks for that step's Writes, Reads, Needs and hotspots, plus the key
files and symbols (`path:line`) its Task Agent will need. Mapping the
dependencies between steps happens after all of them return.

Be conservative: if a step's footprint cannot be pinned down (e.g. "refactor
wherever needed"), mark its Writes as `unknown`.

### Keep the research for the Task Agent

The footprint research already finds the files, symbols and relations each
step touches. Do not throw it away: the Orchestrator saves each synthesis to
`.dev/research/step-[N]-[short-name].md` (the Research Sub-agent itself
stays read-only; the Orchestrator writes the file). The step's brief then
carries the key findings and points at that file, so the Task Agent starts
where the research ended instead of exploring the same code again. See
`references/context-scratchpad.md`.

### Pick a runner per step

Also record, per step, which runner it needs
(`references/terminal-launch.md` section 6):

- **terminal** (default): a full CLI session in its own terminal.
- **inline**: a small step (at most 2 known owned files, no hotspot, no
  expected escalation, no research needed beyond `.dev/research/`) that
  runs as an inline agent in the Orchestrator's session, without a terminal.

When in doubt, terminal. The runner is shown in the preview, and the Lead
can change it at the mandatory pause.

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

## 3. Schedule by dependencies, not by waves

Steps start as soon as they can, not in fixed batches. A wave barrier makes
every step of wave 2 wait for the slowest step of wave 1, even steps that
only needed a fast one.

A step is **ready** when all of these hold:

1. every step in its `Needs` has a `Complete` result;
2. it is independent (section 2) of every step currently running;
3. fewer than the concurrency cap (default 4 Task Agents) are running,
   unless the Lead set another cap.

Launch rule: every time a result arrives (and once at the start), launch
every ready step, lowest step number first, until the cap is reached.
Never launch a step whose `Needs` include a step that is `Blocked` or
`Failed`.

### Preview for the Lead

Before the mandatory pause, simulate the launch rule to show when each step
can start at the earliest. Group the preview by start condition, not as
fixed waves:

```
Start now (parallel):     step 1 auth-model, step 3 email-templates (inline)
After 1:                  step 2 auth-routes (routes use User model)
After 3:                  step 4 docs
After 2 and 4:            step 5 wire-up (touches package.json, like 1)

Co-dependent: 1->2, 3->4, 2+4->5; 1 and 5 both edit package.json
Concurrency cap: 4
```

Step 4 starts as soon as step 3 is done, even if step 1 is still running.

## 4. Show it to the Lead in the mandatory pause

Show the preview, then ask the mandatory question verbatim (unless the
Lead's request already named the mode, see `SKILL.md` step 5). If the Lead
chooses multi-agent, the launch rule with this dependency map is the
schedule; the Lead may instead ask for strictly sequential execution
(cap 1), change the cap, or add ordering constraints.

Record the map, the preview and the cap in the scratchpad's
`## Dependency Map` section.

## 5. During execution

- Each Task Agent's brief lists its **owned files** (its `Writes`) and the
  steps running at the same time as it, with their owned files.
- Waiting for results never happens in the conversation: see
  `references/terminal-launch.md` section 5.
- When a result arrives, merge it into the scratchpad first, then apply the
  launch rule, so newly launched steps see the new state in their briefs.
- **Refresh stale research before a launch.** The footprint research was
  taken before any step ran. Before writing a brief, compare the Files
  touched of every step completed since that research with this step's
  Reads and Writes. If they overlap, run one Research Sub-agent on the
  overlapping files first (its brief lists them as "changed since the
  graph was built"), rewrite `.dev/research/step-[N]-[short-name].md` with
  a new `Taken after:` header, and use the refreshed findings. If they do
  not overlap, launch with the existing research; the brief still lists
  what completed since.
- **Lead decisions reach running steps.** Whenever a Lead decision is logged
  (from a result's `Lead decisions` or from an escalation you raised),
  append it to `.dev/tasks/_decisions.md` right away. Task Agents re-read
  that file before writing their result. If the decision plausibly affects
  a step that is already running, tell the Lead which step and why, so they
  can also answer in that step's terminal. When that step's result arrives,
  check it against the decision before launching its dependents.
- **Every relaunch carries a `## Previous attempt` section** (template in
  `references/agent-hierarchy.md`) and starts in a fresh worktree with the
  earlier attempt's partial work carried over
  (`references/worktrees.md` section 7). A fresh session never starts a
  step blind to its own earlier edits.
- **Integrate before you schedule.** A `Complete` result is first
  integrated into the Lead's tree (`references/worktrees.md` section 5);
  only then do its dependents count as ready, so their snapshots contain
  its changes. A patch rejected by the ownership or apply check makes the
  step `Blocked`, not `Complete`.
- **`Blocked` with `needs-file: <path>`**: the step does not edit that file.
  Wait until no running step owns the path, add it to the step's owned
  files, log it in the scratchpad, and relaunch the step with a
  `## Previous attempt` section.
- **Any other `Blocked`, or `Failed`**: surface it to the Lead, and hold
  only the steps that depend on it (directly or transitively). Steps that
  do not depend on it keep running, and new independent steps keep
  launching. If the Lead answers in the Task Agent's terminal, that agent
  continues and replaces its result file; the orchestrator then treats it
  like any new result.
- Execution halts completely only when nothing is running and every
  remaining step depends on a `Blocked` or `Failed` step.
- Final checks still run once, after every step is `Complete`
  (`rules/high-checks-not-tests.md`).
