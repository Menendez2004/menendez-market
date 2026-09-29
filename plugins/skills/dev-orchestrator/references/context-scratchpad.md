# Context Scratchpad format

## Purpose

In multi-agent mode, worker agents must not receive the full chat history --
only their own step's instructions plus whatever project state they actually
need. The Context Scratchpad is that state: a single tracked file the
orchestrator reads before every step and updates after every step, instead
of relying on conversation memory.

## Location

`.dito/orchestrator-scratchpad.md`, relative to the project root. Create the
`.dito/` directory if it does not exist. This file is plain markdown so the
Lead can open and read it directly at any time without tooling.

## Format

```markdown
# Orchestrator Scratchpad

## Task

<The Lead's original task submission, verbatim.>

## Plan

<The step-by-step plan generated during triage, as a numbered list. Empty /
"N/A -- simple task" if triage classified this as simple.>

## Decisions Log

<Append-only. One entry per Lead decision, in the form:>
- <YYYY-MM-DD HH:MM> -- <what was asked> -> <what the Lead decided>

## Current Step

<Which plan step is in progress right now, or "Complete" / "Blocked,
awaiting Lead" if applicable.>

## Worker Handoffs

<One subsection per worker dispatched, in the form:>

### Step <N>: <short step title>
- Dispatched: <what instructions the worker received>
- Result: <what the worker reported back -- files touched, tests run, status>
```

## Update discipline

- **Before** dispatching a worker or starting a step yourself: read the
  whole file so you have current state.
- **After** a step completes (by you or a worker): append to `Decisions Log`
  if a Lead decision was involved, update `Current Step`, and add a
  `Worker Handoffs` subsection if a worker was involved.
- Never delete history from `Decisions Log` or `Worker Handoffs` -- both are
  append-only, so the Lead can always reconstruct how the project got to its
  current state.
