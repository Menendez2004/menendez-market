---
title: Never guess on ambiguity, missing requirements, or architecture
impact: CRITICAL
tags: [escalation, hitl, ambiguity, architecture]
---

**Incorrect (orchestrator hits a missing requirement mid-step):**

```
Step 3 of the plan says "add rate limiting to the endpoint" but doesn't
specify a limit. The orchestrator picks 100 req/min because it seems
reasonable, implements it, and moves to step 4 without telling the Lead.
```

This is a guess presented as a decision. The Lead never saw that a decision
was made, let alone got to make it.

**Correct (orchestrator hits the same missing requirement):**

```
The orchestrator stops before implementing step 3 and emits:

escalate_to_lead({
  "reason": "ambiguous_requirement",
  "context": "Step 3 (add rate limiting to POST /orders) does not specify a
              limit or window.",
  "options": ["100 req/min per API key", "1000 req/min per API key",
              "Let me know a different limit"],
  "blocking": true
})

Then it halts and waits for the Lead's reply before writing any code for
step 3.
```

**Why it matters:** The entire premise of this skill is that architectural
and ambiguous-requirement decisions belong to the Lead Developer, not the
agent. An agent that fills gaps with its own best guess -- even a reasonable
one -- silently converts a human-in-the-loop system into a fully autonomous
one, which is exactly what this skill exists to prevent. A wrong guess here
compounds: later steps get built on top of an unapproved decision, making it
more expensive to unwind the further execution proceeds.
