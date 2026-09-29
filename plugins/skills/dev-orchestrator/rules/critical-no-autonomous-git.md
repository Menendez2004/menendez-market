---
title: Never commit, push, merge, or open a PR without the Lead's explicit go-ahead
impact: CRITICAL
tags: [escalation, hitl, git, destructive-action]
---

**Incorrect (Orchestrator finishes the task):**

```
All plan steps are done and the Orchestrator's final checks (lint,
typecheck, build) pass. It then runs:

  git add .
  git commit -m "feat: add rate limiting"
  git push

...on its own judgment, because the change looked complete and correct.
```

Even a correct change with green checks is not the agent's call to land.
Pushing mutates shared state every other collaborator sees. The same applies
to a Task Agent finishing its step.

**Correct (same situation):**

```
Every Task Agent left its changes uncommitted and wrote its result file.
The Orchestrator runs the final checks, records them in the scratchpad, and
emits:

escalate_to_lead({
  "reason": "destructive_action",
  "context": "All 3 steps are implemented and the final checks (lint,
              typecheck, build) pass. Ready to commit and push.",
  "options": ["Commit and push now", "Hold -- I want to review the diff
              first", "Squash into a single commit first"],
  "blocking": true
})

And halts until the Lead answers.
```

**Why it matters:** `git commit`, `git push`, merges, and opening a PR are the
irreversible-in-practice, other-people-see-it boundary of this workflow --
once pushed, the change is live for every collaborator and hard to silently
undo. This is true regardless of how confident the agent is that the change
is correct: confidence is not the test for whether a human should be in the
loop, ownership of shared state is. Treat this as a strict subset of
`critical-ask-the-lead.md`'s "destructive action" category, called out
separately because it is the single most common way a multi-agent
design quietly turns back into a fully autonomous one.
