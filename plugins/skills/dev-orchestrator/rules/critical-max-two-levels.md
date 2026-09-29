---
title: Never exceed two agent levels below the Orchestrator
impact: CRITICAL
tags: [hierarchy, multi-agent, task-agent, research-subagent]
---

**Incorrect (a Task Agent delegates its step onward):**

```
Task Agent for step 2 decides the step is big, opens a new terminal
"orch-s2b-tests" and starts another claude session there to
write the tests, while it keeps editing the service. That session in turn
spawns an Agent-tool helper that edits fixtures.
```

That is Level 3 and Level 4, plus two writers in the same step. The Lead's
plan no longer maps to what is running, and nobody owns the result.

**Correct (same situation):**

```
Task Agent for step 2 spawns one read-only Research Sub-agent (Agent tool,
Explore type): "Which modules call RateLimiter and how are they tested? Use
graphify first if available." It gets a 10-line synthesis back, then writes
the code AND the tests itself. If the step is genuinely too big, it marks
the step Blocked and escalates to the Lead to split the plan.
```

**Limits:**

- Level 0 -- Orchestrator: launches Task Agents (multi-agent) or Research
  Sub-agents (single session). Nothing else spawns Task Agents.
- Level 1 -- Task Agent: may spawn Research Sub-agents only. Never another
  Task Agent, never a new terminal, never a writing sub-agent.
- Level 2 -- Research Sub-agent: spawns nothing.

When briefing a Research Sub-agent, prefer a subagent type without the Agent
tool (e.g. `Explore` in Claude Code) so the limit is enforced structurally.

**Why it matters:** Each extra level hides work from the Lead and from the
scratchpad, multiplies context and cost, and makes a failed step impossible
to attribute. Two levels are enough: one level to isolate each plan step,
one to keep investigation out of the step's context.
