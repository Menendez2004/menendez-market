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
  task is complex -- drafts one in plan mode under `opusplan`
  (`references/models.md`) or requests one.
- Asks the mandatory single-session vs. multi-agent question.
- Sole writer of `.dev/orchestrator.md`.
- Launches one Task Agent per plan step in the user's terminal
  (`references/terminal-launch.md`), then merges each result.
- Never implements a step itself in multi-agent mode.
- Runs the final checks once, after every step is complete, and never runs
  tests (`rules/high-checks-not-tests.md`).

### Task Agent (Level 1)

- An independent, full CLI session running in its own terminal named
  `orch-s[N]-[short-name]`, on the latest Sonnet (`claude --model sonnet`).
  Small steps can instead run as an **inline** Task Agent in the
  Orchestrator's session, with the same brief and rules but no terminal and
  no Research Sub-agents (`references/terminal-launch.md` section 6).
- Starts from the research already in its brief and in
  `.dev/research/step-[N]-[short-name].md`; spawns a Research Sub-agent only
  for questions that research does not answer.
- Executes exactly **one** plan step: the one in its brief.
- May modify code needed for that step (non-destructive changes only;
  destructive ones go through `escalate_to_lead`).
- Never runs tests or checks; verification happens once at the end.
- **Is allowed to** spawn Research Sub-agents via the inline `Agent` tool to
  investigate before editing, so exploration does not fill its own context.
- Must not: launch other Task Agents, open terminals, touch other steps'
  scope, or commit/push/merge/open PRs.
- Writes its outcome to `.dev/tasks/step-[N]-[short-name].result.md.tmp`
  and renames it to `.result.md` (atomic), and never edits the shared
  scratchpad directly.

### Research Sub-agent (Level 2)

- Ephemeral, spawned inline by a Task Agent (or by the Orchestrator in
  single-session mode).
- Runs on Sonnet 4.6 through the plugin's `orch-researcher` agent
  (`references/models.md`). Never pass a `model` parameter on the `Agent`
  call.
- **Strictly read-only**: reads files, runs searches, reads logs and docs,
  runs read-only analysis tools. No `Edit`/`Write`, no state-changing shell
  commands, no git mutations.
- **Graphify first (conditional)**: before manual searches or bulk reading,
  checks whether `graphify` is available; if it is, uses it first to map
  AST, dependency graphs and component relations (`references/graphify.md`).
- Returns a short synthesis (see template below) and ends.
- Cannot spawn any agent and never talks to the Lead.

In Claude Code, spawn it with `subagent_type:
"dev-orchestrator:orch-researcher"`: its definition has no `Edit`, `Write`
or `Agent` tool, so the restriction is enforced by the tool set, not just by
the prompt (fallback: `Explore`, see `references/models.md`). Never use a
subagent type that inherits the parent's conversation (a fork): the Research Sub-agent starts with only its brief, and
its brief carries only the question and scope, not the Task Agent's history.

## Task Agent brief template

The rules every Task Agent follows are the same for every step, so they are
not repeated in each brief. Before launching the first Task Agent, the
Orchestrator copies `references/task-agent-rules.md` verbatim to
`.dev/tasks/_rules.md`, once per task, and each brief points at it. Briefs
stay short and the rules stay identical across steps.

The Orchestrator writes this to `.dev/tasks/step-[N]-[short-name].md` before
launching the Task Agent:

```markdown
# Task Agent brief -- step <N>: <short step title>

Terminal / session name: orch-s<N>-<short-name>

## Your step (do only this)

<The step text, copied verbatim from the plan.>

## Owned files

<The step's Writes from the dependency map. You may edit only these.>

## Running at the same time as you

<Other steps running when you launch, with their owned files, or "none".>

## Context you need (scoped -- not the full scratchpad)

- Task goal: <one or two lines summarizing the Lead's task>
- Decisions that affect this step: <only the relevant Decisions Log entries, or "none">
- Output of the steps you need: <for each step in this step's Needs: files
  touched + "Notes for next steps" from its result file, or "none">
- Output of indirect dependencies: <for each step reached only through
  Needs of Needs: its "Notes for next steps" only, or "none">
- Shared decisions: `.dev/tasks/_decisions.md` (read it now and again
  before writing your result)

## Research already done (start here)

<Key findings from the Orchestrator's footprint research for this step:
files and symbols to change (path:line), dependents, risks; graphify used
yes/no. Then: "Full synthesis: .dev/research/step-<N>-<short-name>.md", or
"none".>

- Research taken after: <steps that were Complete when it was taken, or
  "no step had run">
- Completed since then: <step: files touched, for each step completed after
  the research, or "none">. Line numbers and symbols in those files may have
  moved: re-read them before relying on this research.

## Previous attempt (relaunches only)

<Only when this step ran before (needs-file, Fix, relaunch after an inline
escalation, resume after a crash): the previous result file's Status, Files
touched and Notes, the escalation answer if any, and the output of
`git diff --stat -- <owned files>`. Omit the section on a first launch.>

## Rules

Read `.dev/tasks/_rules.md` before doing anything and follow it. It is part
of this brief. Your step number and short name are in the title and the
terminal name above.
```

## Task Agent result format

(Also included in `references/task-agent-rules.md`, which is what Task
Agents actually read.)

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

With `orch-researcher` the rules below are already in the agent's
definition, so the brief only needs the `Question` and `Scope` lines (plus
`Files changed since the graph was built` once any step has completed). With
the `Explore` fallback, send the whole text.

```text
You are a Level 2 Research Sub-agent. You are STRICTLY READ-ONLY: do not
create, edit or delete files, do not run state-changing commands, do not use
git to change anything, do not run tests, and do not spawn any agent.

Question: <one focused question>
Scope: <paths / services / logs to look at>
Files changed since the graph was built: <Files touched of completed steps, or "none">

1. Check whether graphify is available (see references/graphify.md). If it
   is, use it FIRST to map dependencies and relations relevant to the
   question before any manual search or bulk reading.
2. Fill gaps with targeted searches and reads.
3. Reply with at most ~15 lines: answer, key files (path:line), relevant
   dependencies, risks, and whether graphify was used. Then stop.
```
