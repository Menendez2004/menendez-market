# Agent hierarchy: levels, roles, permissions, briefs

## Levels

| Level | Agent | How it is created | Lifetime |
| --- | --- | --- | --- |
| 0 | Orchestrator Hub | The Lead's main session | Whole task |
| 1 | Task Agent | Orchestrator opens a new terminal and starts a full CLI session (`claude`) in it | One plan step |
| 2 | Research Sub-agent | A Task Agent calls the inline `Agent` tool | One question |

Maximum depth is **2**. There is no Level 3: a Research Sub-agent cannot
create anything, and a Task Agent cannot create another Task Agent or open a
terminal. See `rules/critical-max-two-levels.md`.

In **single-session** mode there are no Task Agents: the Orchestrator does
the steps itself and may spawn Research Sub-agents directly (they are then
Level 1, with exactly the same read-only, no-spawn restrictions).

## Roles and permissions

### Lead Developer (human)

- Provides the plan most of the time, or approves the one the Orchestrator
  proposes.
- Makes every architectural decision and has the final word.
- Is the only one who commits, pushes, merges or opens PRs (or explicitly
  authorizes it per `rules/critical-no-autonomous-git.md`).

### Orchestrator Hub (Level 0)

- Receives the task, adopts and validates the Lead's plan
  (`rules/high-adopt-lead-plan.md`), or -- only if there is no plan and the
  task is complex -- proposes one with `model: "opus"` or requests one.
- Asks the mandatory single-session vs. multi-agent question.
- Sole writer of `.dito/orchestrator-scratchpad.md`.
- Launches one Task Agent per plan step in the user's terminal
  (`references/terminal-launch.md`), then merges each result.
- Never implements a step itself in multi-agent mode.

### Task Agent (Level 1)

- An independent, full CLI session running in its own terminal named
  `orchestrator-task-step-[N]-[short-name]`.
- Executes exactly **one** plan step: the one in its brief.
- May modify code needed for that step (non-destructive changes only;
  destructive ones go through `escalate_to_lead`).
- **Is allowed to** spawn Research Sub-agents via the inline `Agent` tool to
  investigate before editing, so exploration does not fill its own context.
- Must not: launch other Task Agents, open terminals, touch other steps'
  scope, or commit/push/merge/open PRs.
- Writes its outcome to `.dito/tasks/step-[N]-[short-name].result.md` and
  never edits the shared scratchpad directly.

### Research Sub-agent (Level 2)

- Ephemeral, spawned inline by a Task Agent (or by the Orchestrator in
  single-session mode).
- **Strictly read-only**: reads files, runs searches, reads logs and docs,
  runs read-only analysis tools. No `Edit`/`Write`, no state-changing shell
  commands, no git mutations.
- **Graphify first (conditional)**: before manual searches or bulk reading,
  checks whether `graphify` is available; if it is, uses it first to map
  AST, dependency graphs and component relations (`references/graphify.md`).
- Returns a short synthesis (see template below) and ends.
- Cannot spawn any agent and never talks to the Lead.

In Claude Code, prefer a built-in read-only subagent type (e.g.
`subagent_type: "Explore"`) so the restriction is enforced by the tool set,
not just by the prompt.

## Task Agent brief template

The Orchestrator writes this to `.dito/tasks/step-[N]-[short-name].md` before
launching the terminal:

```markdown
# Task Agent brief -- step <N>: <short step title>

Terminal / session name: orchestrator-task-step-<N>-<short-name>

## Your step (do only this)

<The step text, copied verbatim from the plan.>

## Current project state

<Full current contents of .dito/orchestrator-scratchpad.md.>

## Rules you must follow

- You are a Level 1 Task Agent. Execute only the step above.
- You MAY spawn read-only Research Sub-agents with the Agent tool to
  investigate before editing. Brief them with the Research template in
  references/agent-hierarchy.md: read-only, graphify first if available,
  no further agents, short synthesis.
- You MUST NOT launch other Task Agents, open terminals, or spawn any agent
  that can write.
- Never commit, push, merge or open a PR. Leave changes uncommitted.
- On ambiguity, an architectural choice, or any destructive action: emit
  escalate_to_lead (references/escalate-to-lead-schema.md) in this terminal,
  mark the step Blocked in your result file, and stop.
- Do not edit .dito/orchestrator-scratchpad.md. When done (or blocked),
  write .dito/tasks/step-<N>-<short-name>.result.md using the result format.
```

## Task Agent result format

```markdown
# Result -- step <N>: <short step title>

- Status: Complete | Blocked | Failed
- Files touched: <paths>
- Tests / checks run: <commands and outcome>
- Research used: <one line per Research Sub-agent: question -> synthesis; note whether graphify was used>
- Open questions / escalations: <none, or the escalate_to_lead payload>
- Notes for next steps: <anything later steps need to know>
```

## Research Sub-agent brief template

```text
You are a Level 2 Research Sub-agent. You are STRICTLY READ-ONLY: do not
create, edit or delete files, do not run state-changing commands, do not use
git to change anything, and do not spawn any agent.

Question: <one focused question>
Scope: <paths / services / logs to look at>

1. Check whether graphify is available (see references/graphify.md). If it
   is, use it FIRST to map dependencies and relations relevant to the
   question before any manual search or bulk reading.
2. Fill gaps with targeted searches and reads.
3. Reply with at most ~15 lines: answer, key files (path:line), relevant
   dependencies, risks, and whether graphify was used. Then stop.
```
