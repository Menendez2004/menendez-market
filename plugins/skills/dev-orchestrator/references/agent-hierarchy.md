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
- Sole writer of `.dev/orchestrator.md`.
- Launches one Task Agent per plan step in the user's terminal
  (`references/terminal-launch.md`), then merges each result.
- Never implements a step itself in multi-agent mode.
- Runs the final checks once, after every step is complete, and never runs
  tests (`rules/high-checks-not-tests.md`).

### Task Agent (Level 1)

- An independent, full CLI session running in its own terminal named
  `orch-s[N]-[short-name]`.
- Executes exactly **one** plan step: the one in its brief.
- May modify code needed for that step (non-destructive changes only;
  destructive ones go through `escalate_to_lead`).
- Never runs tests or checks; verification happens once at the end.
- **Is allowed to** spawn Research Sub-agents via the inline `Agent` tool to
  investigate before editing, so exploration does not fill its own context.
- Must not: launch other Task Agents, open terminals, touch other steps'
  scope, or commit/push/merge/open PRs.
- Writes its outcome to `.dev/tasks/step-[N]-[short-name].result.md` and
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
not just by the prompt. Never use a subagent type that inherits the parent's
conversation (a fork): the Research Sub-agent starts with only its brief, and
its brief carries only the question and scope, not the Task Agent's history.

## Task Agent brief template

The Orchestrator writes this to `.dev/tasks/step-[N]-[short-name].md` before
launching the terminal:

```markdown
# Task Agent brief -- step <N>: <short step title>

Terminal / session name: orch-s<N>-<short-name>

## Your step (do only this)

<The step text, copied verbatim from the plan.>

## Owned files

<The step's Writes from the dependency map. You may edit only these.>

## Running in parallel with you

<Other steps in this wave and their owned files, or "none".>

## Context you need (scoped -- not the full scratchpad)

- Task goal: <one or two lines summarizing the Lead's task>
- Decisions that affect this step: <only the relevant Decisions Log entries, or "none">
- Output of the steps you need: <for each step in this step's Needs: files
  touched + "Notes for next steps" from its result file, or "none">

## Rules you must follow

- You are a Level 1 Task Agent. Execute only the step above.
- You MAY spawn read-only Research Sub-agents with the Agent tool to
  investigate before editing. Brief them with the Research template in
  references/agent-hierarchy.md: read-only, graphify first if available,
  no further agents, short synthesis.
- You MUST NOT launch other Task Agents, open terminals, or spawn any agent
  that can write.
- Edit only your owned files. If you must edit anything else, do not edit
  it: mark the step Blocked with `needs-file: <path>` in your result file and
  stop (other agents may be editing it right now).
- Never commit, push, merge or open a PR. Leave changes uncommitted.
- Never run tests, and do not run checks (lint, typecheck, build): the
  Orchestrator runs checks once after the whole task. Writing test files is
  fine if your step asks for it.
- On ambiguity, an architectural choice, or any destructive action: emit
  escalate_to_lead (references/escalate-to-lead-schema.md) in this terminal,
  mark the step Blocked in your result file, and stop.
- Everything you need is in this brief. Do not read .dev/orchestrator.md or
  other steps' briefs/results.
- If the Lead answers an escalation in this terminal, record the question and
  answer under `Lead decisions` in your result file.
- Do not edit .dev/orchestrator.md. When done (or blocked),
  write .dev/tasks/step-<N>-<short-name>.result.md using the result format.
```

## Task Agent result format

```markdown
# Result -- step <N>: <short step title>

- Status: Complete | Blocked | Failed
- needs-file: <path, only if Blocked because a file outside your owned files must change>
- Files touched: <paths>
- Research used: <one line per Research Sub-agent: question -> one-line conclusion; graphify yes/no. Not the full synthesis.>
- Lead decisions: <escalations the Lead answered in this terminal, question -> answer, or none>
- Open questions / escalations: <none, or the escalate_to_lead payload>
- Notes for next steps: <at most ~5 lines that dependent steps need (new APIs, names, contracts)>
```

## Research Sub-agent brief template

```text
You are a Level 2 Research Sub-agent. You are STRICTLY READ-ONLY: do not
create, edit or delete files, do not run state-changing commands, do not use
git to change anything, do not run tests, and do not spawn any agent.

Question: <one focused question>
Scope: <paths / services / logs to look at>

1. Check whether graphify is available (see references/graphify.md). If it
   is, use it FIRST to map dependencies and relations relevant to the
   question before any manual search or bulk reading.
2. Fill gaps with targeted searches and reads.
3. Reply with at most ~15 lines: answer, key files (path:line), relevant
   dependencies, risks, and whether graphify was used. Then stop.
```
