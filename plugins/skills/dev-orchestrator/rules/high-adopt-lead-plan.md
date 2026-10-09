---
title: Adopt a Lead-provided plan as-is; never create or regenerate it
impact: HIGH
tags: [planning, hitl, lead-plan]
---

**Incorrect (Lead sends a 4-step plan):**

```
The Orchestrator reads the Lead's plan, decides step 3 could be split and
step 4 is unnecessary, runs an Opus planning pass "to improve it", and starts
executing the new 5-step plan.
```

The Lead approved four steps and is now watching five different ones run.

**Correct (same plan):**

```
The Orchestrator copies the 4 steps verbatim into the scratchpad with
"Source: Lead-provided", validates them (files exist, steps are concrete,
dependencies clear), and finds step 3 names a table that doesn't exist:

escalate_to_lead({
  "reason": "ambiguous_requirement",
  "context": "Step 3 migrates table `user_profiles`, but only `profiles`
              exists in db/schema.sql.",
  "options": ["Use `profiles`", "Create `user_profiles` first",
              "I'll update the plan"],
  "blocking": true
})

After the Lead answers, it logs the decision and asks the mandatory
single-session vs. multi-agent question. The step list itself stays the
Lead's.
```

**Rules:**

- A plan in the initial request or in the scratchpad's `## Plan` section is
  the plan. Adopt, validate, move on to the mandatory pause.
- Validation finds gaps; it never fixes them silently. Every change to the
  plan comes from the Lead.
- Have the Planner Agent (`orch-planner`, Opus) draft a plan **only** when no plan was
  provided and the task is complex, and treat it as a draft until the Lead
  approves.

**Why it matters:** The Lead writing the plan is the normal case, and it is
where the architectural decisions live. Regenerating it wastes the strongest
model on work already done and quietly replaces the Lead's decisions with
the agent's.
