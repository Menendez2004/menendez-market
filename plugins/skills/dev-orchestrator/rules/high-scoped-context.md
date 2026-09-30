---
title: Give each agent only the context its step needs
impact: HIGH
tags: [context, briefs, task-agent, research-subagent, scratchpad]
---

**Incorrect (launching step 5 of 6):**

```
The Orchestrator pastes the whole .dev/orchestrator.md into step 5's brief:
the Lead's full original message, every Decisions Log entry, the handoffs
of steps 1-4 with their full research syntheses, and the dependency map.
The Task Agent for step 5 then spawns a Research Sub-agent as a fork of its
own conversation, so the sub-agent starts with all of that too.
```

Step 5 needed one function name from step 3. Everything else is noise that
grows with every step, and it can steer the agent toward other steps' work.

**Correct (same launch):**

```
Step 5's brief contains: its step text, owned files, parallel peers, a
two-line task goal, the one decision about error codes that affects it, and
step 3's "Notes for next steps" (the new function name). The Research
Sub-agent it spawns is a fresh read-only orch-researcher agent whose brief
is one question and a scope, and it returns ~10 lines.
```

**Rules:**

- A Task Agent brief carries only: its step, owned files, parallel peers, the
  task goal, decisions that affect this step, the output of the steps it
  `Needs` (plus only the "Notes for next steps" of indirect dependencies), and the key findings of its own footprint research (with a
  pointer to `.dev/research/step-[N]-[short-name].md`). Never the full
  scratchpad, never the chat history. The fixed Task Agent rules are not
  pasted either: the brief points at `.dev/tasks/_rules.md`.
- Task Agents do not read the scratchpad or other steps' briefs, results or
  research. The only shared file they read is `.dev/tasks/_decisions.md`,
  so a decision the Lead makes in one terminal reaches steps already
  running. They start from their own research and do not re-investigate
  what it already answers.
- Research Sub-agents start from their brief alone (no fork of the parent's
  conversation) and return a short synthesis; result files keep one line per
  research conclusion, not the synthesis.
- Lead answers given in a Task Agent's terminal go into its result file so
  the Orchestrator can log them; decisions never live only in one terminal.
- `.dev/` stays out of commits (in `.gitignore`, or the Lead confirms).

**Why it matters:** Isolating each step is the reason Task Agents and
Research Sub-agents exist. Passing everything to everyone rebuilds the
shared, ever-growing context the design is meant to avoid, costs tokens on
every launch, and lets one step's details leak into another step's choices.
