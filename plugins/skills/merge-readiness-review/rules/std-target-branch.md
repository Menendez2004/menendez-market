---
title: Explicit, freshly fetched target; judge the merged result
impact: CRITICAL
tags:
  - git
  - target
  - scope
---

## Rule

1. The target branch is the one the user names. If none is named, ask
   once (suggest the PR's base or the repo's default branch). Never pick
   one silently. An orchestrator brief without a target → return Blocked.
2. Fetch it before anything else (`git fetch origin <target>`) and judge
   against `origin/<target>` at that SHA, not a local branch that may be
   behind. Record the SHA in the report. Same for the source in Modes B/C.
3. The unit under review is **the merged result** of source into target:
   `merge-base(target, source)` → what the source adds → on top of
   everything the target added since that base.
4. Mode A (source = `HEAD`): uncommitted and untracked changes are not
   part of the merge. Say so; never include them silently.

**Incorrect:**

```bash
git diff main...HEAD          # local main, maybe weeks old
npm test                      # on the source branch only
# "Tests pass, safe to merge."
```

- Error: Stale target, and the merged tree was never built or tested.

**Correct:**

```bash
git fetch origin main
python3 scripts/merge_probe.py --target main      # base, ahead/behind, conflicts
# build a temp worktree at origin/main, run baseline, merge source --no-commit, run again
```

**Why it matters:** A branch that is green on its own can be red after
the merge: the target may have renamed a function it calls, added a
required column, or bumped a dependency. Only the merged tree answers
the question the user asked.
