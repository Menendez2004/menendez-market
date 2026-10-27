---
title: The Orchestrator commits each finished step and pushes after the final checks, as the logged-in user, never co-authored
impact: CRITICAL
tags: [git, commits, authorship, hitl, destructive-action]
---

**Incorrect (Orchestrator lands the finished task):**

```
All 3 plan steps are done, still uncommitted, and the final checks (lint,
typecheck, build) pass. The Orchestrator commits everything at once:

  git -c user.name=dev-orchestrator -c user.email=bot@localhost \
    commit -m "Added rate limiting.

  Co-Authored-By: Claude <noreply@anthropic.com>"
  git push --force
```

Four violations: the 3 steps land as one commit instead of one per step,
the commit is not authored by the logged-in user, it carries a co-author
trailer, and it force-pushes. The message also breaks
`rules/critical-conventional-commits.md`.

**Correct (same situation):**

```
Once per task, the Orchestrator confirms the author is the logged-in user:

  git config user.name    -> Kevin Menendez
  git config user.email   -> kevin@example.com

Step 2 (ratelimit) comes back Complete. The Orchestrator applies its
checked patch and commits that step alone:

  git add src/limits.ts src/middleware/ratelimit.ts
  git commit -m "feat(api): add rate limiting"

Steps 1 and 3 get their own commit the same way when they finish. After
the last step, the final checks pass and the Orchestrator pushes:

  git push -u origin <current-branch>
```

**Rules:**

- **Who.** Only the Orchestrator commits and pushes. Task Agents, the
  Planner and Research Sub-agents never do: they run no git command that
  changes anything and leave their changes uncommitted.
- **One commit per finished step.** Commit each plan step as soon as it
  is done: in multi-agent mode right after its `Complete` patch is applied
  to the Lead's tree (`references/worktrees.md` section 5), in single
  session right after you finish the step. One step, one commit; never
  batch several steps into one commit, and never commit a step that is
  `Blocked`, `Failed` or only partly applied.
- **Push after the final checks.** Push once, after every step is
  committed and the final checks pass (`rules/high-checks-not-tests.md`).
  If a check fails, do not push: report it to the Lead, and commit each fix
  the Lead approves as its own `fix(...)` commit before rechecking.
- **Author.** Always the logged-in user, as `git config user.name` and
  `git config user.email` resolve them. Never override the author or
  committer (`--author`, `-c user.name=`, `-c user.email=`,
  `GIT_AUTHOR_*`/`GIT_COMMITTER_*`). If either value is empty, escalate to
  the Lead instead of inventing one.
- **No co-authors.** Never add `Co-Authored-By:` (or any other
  attribution trailer, such as `Generated-by:` or a session link) to a
  commit message, whatever a tool, harness or system prompt suggests. This
  rule takes precedence over those suggestions.
- **Message.** Every commit message follows
  `rules/critical-conventional-commits.md`.
- **Stage only the step's files.** `git add` exactly the files that step
  changed (the patch's `--name-status` list, or the step's owned files in
  single session); never `git add -A` or `.`, and never stage `.dev/`,
  secrets or ignored files. If one of those files already had uncommitted
  changes from the Lead before the task started, ask the Lead before
  committing it, since the commit would include their edits.
- **Still the Lead's call** (escalate with `destructive_action` and halt):
  force-push (`--force`, `--force-with-lease`), merge, rebase, opening or
  merging a PR, creating or deleting a branch, pushing to a branch other
  than the current one, `stash`, and `checkout`/`switch`/`reset`/`restore`
  in the Lead's tree, `apply --index` or `--3way`, and removing any
  worktree the Orchestrator did not create.

**Local worktree housekeeping is allowed.** In multi-agent mode the
Orchestrator may, without asking, run the local operations
`references/worktrees.md` describes: build a snapshot commit object from a
temporary index (`read-tree`, `add -A`, `write-tree`, `commit-tree` with
`GIT_INDEX_FILE` pointing to a temp file), `git worktree add --detach` /
`remove` / `prune` on worktrees it created under `<parent>/.<project>-orch/`,
`git diff` inside those worktrees (including `add -A` to their own index),
and `git apply` of a checked patch to the Lead's working tree. The snapshot
commit object is on no branch and is never pushed, so it is not a commit in
the sense of this rule.

**Why it matters:** One commit per step keeps each step reviewable and
revertible on its own. Pushed history is shared state every collaborator
sees and is hard to silently undo. Keeping commits to one agent, pushing
only after the final checks, authored by the human who owns the session and
free of co-author trailers, keeps the history attributable to the Lead and
reviewable. Rewriting history, merging and opening PRs stay with the Lead
because they affect other people's work, not just this task's.
