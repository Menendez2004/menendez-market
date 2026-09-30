# Context Scratchpad format

## Purpose

In multi-agent mode, Task Agents must not receive the full chat history --
only their own step's instructions plus the project state they need. The
Context Scratchpad is that state: a single tracked file the Orchestrator reads
before every step and updates after every step, instead of relying on
conversation memory.

## Location and ownership

- `.dev/orchestrator.md`, relative to the project root. Create the `.dev/`
  directory if it does not exist. This file is plain markdown so the Lead can
  open and read it directly at any time without tooling.
- Task Agent briefs and results live in `.dev/tasks/` (create it if needed).
- Footprint research syntheses live in `.dev/research/`, one file per step,
  written by the Orchestrator from its Research Sub-agents' replies. A Task
  Agent reads only the file its brief names.
- `.dev/` holds the Lead's task, decisions and agent notes, so it must not end
  up in commits. If `.dev/` is not in `.gitignore`, ask the Lead to add it (or
  confirm they want it tracked) before the first write.
- **Only the Orchestrator writes the scratchpad.** Task Agents run in parallel
  terminals, so letting them edit one shared file would race. Each Task
  Agent writes its own `.dev/tasks/step-[N]-[short-name].result.md`; the
  Orchestrator merges it into `Task Agent Handoffs`.
- Research Sub-agents never write anything; their syntheses reach the
  scratchpad only through the Task Agent's result file.

```
<project root>/
  .dev/
    orchestrator.md
    tasks/
      _rules.md                       # Task Agent rules, copied once per task
      step-1-<short-name>.md          # brief (Orchestrator writes)
      step-1-<short-name>.result.md   # result (Task Agent writes)
      step-2-<short-name>.md
      ...
    research/
      step-1-<short-name>.md          # footprint research (Orchestrator writes)
      ...
```

## Format

```markdown
# Orchestrator Scratchpad

## State

<Rewritten in place after every result; at most ~15 lines. The only section
read before every launch.>
- Mode: <single session | multi-agent, cap N>
- Complete: <step numbers>
- Running: <step: runner>
- Ready next: <step numbers, or none>
- Held: <step -> waiting on Blocked/Failed step M, or none>
- Waiting on the Lead: <open escalations, one line each, or none>
- Last updated: <YYYY-MM-DD HH:MM>

## Task

<The Lead's original task submission, verbatim.>

## Plan

Source: <Lead-provided | Orchestrator-proposed (opusplan), approved by Lead on <date> | Orchestrator, simple task>

<The plan as a numbered list. If Lead-provided, copied verbatim -- never
reworded.>

## Dependency Map

<Per step: writes, reads, needs, hotspots, runner (terminal | inline).
Then the start preview, the co-dependencies and the concurrency cap, as
shown to the Lead (references/parallelization.md).>

## Environment

- Execution mode: <single session | multi-agent (sequential) | multi-agent (cap N)>
- User terminal: <tmux | iTerm2 | Windows Terminal | ... | fallback: <how>>
- graphify: <available (existing graph / skill / CLI) | not available>
- Models: <planning / execution / research models actually used>

## Decisions Log

<Append-only. One entry per Lead decision:>
- <YYYY-MM-DD HH:MM> -- <what was asked> -> <what the Lead decided>

## Task Agent Handoffs

<One subsection per step, in the form:>

### Step <N>: <short step title>
- Runner: <terminal orch-s<N>-<short-name> | inline>
- Brief: .dev/tasks/step-<N>-<short-name>.md
- Research: .dev/research/step-<N>-<short-name>.md
- Owned files: <paths>
- Status: <Running | Complete | Blocked | Failed>
- Result: <files touched, research used (graphify yes/no), notes>

## Final Checks

<Filled once, after every step is complete. One line per check:>
- <command> -> <ok | failed: short summary>
```

## Update discipline

- **Before** launching a Task Agent or starting a step yourself, read only:
  `## State`, that step's entry in `## Dependency Map`, the handoffs of the
  steps in its `Needs`, and the `Decisions Log` entries that affect it. Do
  not re-read the whole file: the append-only sections grow with every
  step. Put in the step's brief only the scoped context the brief template
  asks for (task goal, relevant decisions, output of the steps it needs,
  key findings of that step's research). Never paste the whole scratchpad
  or the chat history into a brief.
- When merging a result file, keep the handoff short: status, files touched,
  one line per research conclusion, and the notes for next steps. Merge any
  `Lead decisions` into the `Decisions Log`.
- **After** every result: merge it, append to `Decisions Log` if a Lead
  decision was involved, touch the result's `.merged` marker, and rewrite
  `## State`.
- Never delete history from `Decisions Log` or `Task Agent Handoffs` -- both
  are append-only, so the Lead can always reconstruct how the project got to
  its current state.

## Resuming after an interruption

If a session starts and `.dev/orchestrator.md` already exists for the same
task (the Orchestrator crashed, the context was reset, or the Lead closed
the session), resume instead of starting over. This is the one time the
Orchestrator reads the whole scratchpad.

1. Read the whole scratchpad, then list `.dev/tasks/`.
2. Classify each step:
   - `.result.md` with a newer or equal `.merged` marker -> already merged;
     never relaunch a `Complete` step.
   - `.result.md` without a marker, or newer than it -> merge it now.
   - Brief but no result, runner `terminal` -> check whether its terminal
     is still alive (for tmux: `tmux list-windows -a | grep orch-s<N>-`).
     Alive -> keep waiting for it. Gone, or unknown -> ask the Lead.
   - Brief but no result, runner `inline` -> the agent died with the old
     session.
   - No brief -> not started; the launch rule decides.
3. A step that died mid-way may have left partial edits in its owned files.
   Show the Lead `git diff --stat` for those files and ask whether to
   relaunch it on top of them or have the Lead discard them first. Never
   discard them yourself (`rules/critical-no-autonomous-git.md`).
4. Rewrite `## State`, log the resume in the `Decisions Log`, and continue
   with the launch rule (`references/parallelization.md` section 3).
