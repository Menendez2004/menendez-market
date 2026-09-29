---
title: Never commit, push, merge, or open a PR without the Lead's explicit go-ahead
impact: CRITICAL
tags: [escalation, hitl, git, destructive-action]
---

**Incorrect (Task Agent finishes a step):**

```
A Task Agent finishes implementing step 2, runs the tests, sees them pass,
and then runs:

  git add .
  git commit -m "feat: add rate limiting"
  git push

...on its own judgment, because the change looked complete and correct.
```

Even a correct, well-tested change is not the agent's call to land. Pushing
mutates shared state every other collaborator sees.

**Correct (Task Agent finishes the same step):**

```
The Task Agent finishes implementing step 2, runs the tests, confirms they pass,
leaves the change uncommitted, writes its result file with
"Status: Complete, tests passing, ready for review," and hands control back to
the orchestrator. The orchestrator then emits:

escalate_to_lead({
  "reason": "destructive_action",
  "context": "Step 2 (add rate limiting) is implemented and tests pass. Ready
              to commit and push.",
  "options": ["Commit and push now", "Hold -- I want to review the diff
              first", "Squash with step 1 before committing"],
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
