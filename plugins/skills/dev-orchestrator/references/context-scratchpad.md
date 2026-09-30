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
      step-1-<short-name>.md          # brief (Orchestrator writes)
      step-1-<short-name>.result.md   # result (Task Agent writes)
      step-2-<short-name>.md
      ...
```

## Format

```markdown
# Orchestrator Scratchpad

## Task

<The Lead's original task submission, verbatim.>

## Plan

Source: <Lead-provided | Orchestrator-proposed (opusplan), approved by Lead on <date> | Orchestrator, simple task>

<The plan as a numbered list. If Lead-provided, copied verbatim -- never
reworded.>

## Dependency Map

<Per step: writes, reads, needs, hotspots. Then the waves and the
co-dependencies, as shown to the Lead (references/parallelization.md).>

## Environment

- Execution mode: <single session | multi-agent (sequential) | multi-agent (waves)>
- User terminal: <tmux | iTerm2 | Windows Terminal | ... | fallback: <how>>
- graphify: <available (existing graph / skill / CLI) | not available>
- Models: <planning / execution / research models actually used>

## Decisions Log

<Append-only. One entry per Lead decision:>
- <YYYY-MM-DD HH:MM> -- <what was asked> -> <what the Lead decided>

## Current Step

<Current wave and its steps in progress, or "Complete" / "Blocked,
awaiting Lead".>

## Task Agent Handoffs

<One subsection per step, in the form:>

### Step <N>: <short step title>
- Terminal: orch-s<N>-<short-name>
- Brief: .dev/tasks/step-<N>-<short-name>.md
- Wave: <W>, owned files: <paths>
- Status: <Running | Complete | Blocked | Failed>
- Result: <files touched, research used (graphify yes/no), notes>

## Final Checks

<Filled once, after every step is complete. One line per check:>
- <command> -> <ok | failed: short summary>
```

## Update discipline

- **Before** launching a Task Agent or starting a step yourself: read the
  whole file yourself, but put in the step's brief only the scoped context
  the brief template asks for (task goal, relevant decisions, output of the
  steps it needs). Never paste the whole scratchpad or the chat history into
  a brief: other steps' handoffs, unrelated decisions and research notes are
  noise for that agent and grow with every step.
- When merging a result file, keep the handoff short: status, files touched,
  one line per research conclusion, and the notes for next steps. Merge any
  `Lead decisions` into the `Decisions Log`.
- **After** a step completes: merge the result file, append to `Decisions
  Log` if a Lead decision was involved, and update `Current Step`.
- Never delete history from `Decisions Log` or `Task Agent Handoffs` -- both
  are append-only, so the Lead can always reconstruct how the project got to
  its current state.
