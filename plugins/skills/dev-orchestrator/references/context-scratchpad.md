# Context Scratchpad format

## Purpose

In multi-agent mode, Task Agents must not receive the full chat history --
only their own step's instructions plus the project state they need. The
Context Scratchpad is that state: a single tracked file the Orchestrator reads
before every step and updates after every step, instead of relying on
conversation memory.

## Location and ownership

- `orchestrator-scratchpad.md` at the project root, with Task Agent briefs
  and results in `orchestrator-tasks/` next to it. Create that directory if
  it does not exist. Both are working files: suggest the Lead add them to
  `.gitignore` if they should not be committed.
- **Only the Orchestrator writes the scratchpad.** Task Agents run in parallel
  terminals, so letting them edit one shared file would race. Each Task
  Agent writes its own `orchestrator-tasks/step-[N]-[short-name].result.md`; the
  Orchestrator merges it into `Task Agent Handoffs`.
- Research Sub-agents never write anything; their syntheses reach the
  scratchpad only through the Task Agent's result file.

```
<project root>/
  orchestrator-scratchpad.md
  orchestrator-tasks/
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

Source: <Lead-provided | Orchestrator-proposed (opus), approved by Lead on <date> | Orchestrator, simple task>

<The plan as a numbered list. If Lead-provided, copied verbatim -- never
reworded. Mark independent steps, e.g. "(independent)".>

## Environment

- Execution mode: <single session | multi-agent (sequential) | multi-agent (parallel)>
- User terminal: <tmux | iTerm2 | Windows Terminal | ... | fallback: <how>>
- graphify: <available (existing graph / skill / CLI) | not available>

## Decisions Log

<Append-only. One entry per Lead decision:>
- <YYYY-MM-DD HH:MM> -- <what was asked> -> <what the Lead decided>

## Current Step

<Step in progress, or "Complete" / "Blocked, awaiting Lead".>

## Task Agent Handoffs

<One subsection per step, in the form:>

### Step <N>: <short step title>
- Terminal: orch-s<N>-<short-name>
- Brief: orchestrator-tasks/step-<N>-<short-name>.md
- Status: <Running | Complete | Blocked | Failed>
- Result: <files touched, tests run, research used (graphify yes/no), notes>
```

## Update discipline

- **Before** launching a Task Agent or starting a step yourself: read the
  whole file, and paste its current contents into the step's brief.
- **After** a step completes: merge the result file, append to `Decisions
  Log` if a Lead decision was involved, and update `Current Step`.
- Never delete history from `Decisions Log` or `Task Agent Handoffs` -- both
  are append-only, so the Lead can always reconstruct how the project got to
  its current state.
