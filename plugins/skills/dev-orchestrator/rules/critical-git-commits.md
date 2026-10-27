---
title: Only the Orchestrator commits and pushes, as the logged-in user, never co-authored
impact: CRITICAL
tags: [git, commits, authorship, hitl, destructive-action]
---

**Incorrect (Orchestrator lands the finished task):**

```
All plan steps are done and the final checks (lint, typecheck, build)
pass. The Orchestrator runs:

  git -c user.name=dev-orchestrator -c user.email=bot@localhost \
    commit -m "Added rate limiting.

  Co-Authored-By: Claude <noreply@anthropic.com>"
  git push --force
```

Three violations: the commit is not authored by the logged-in user, it
carries a co-author trailer, and it force-pushes. The message also breaks
`rules/critical-conventional-commits.md`.

**Correct (same situation):**

```
Every Task Agent left its changes uncommitted and wrote its result file.
The Orchestrator runs the final checks, records them in the scratchpad,
confirms the author is the logged-in user:

  git config user.name    -> Kevin Menendez
  git config user.email   -> kevin@example.com

and lands the work on the current branch:

  git add <files the plan changed>
  git commit -m "feat(api): add rate limiting"
  git push -u origin <current-branch>
```

**Rules:**

- **Who.** Only the Orchestrator commits and pushes. Task Agents, the
  Planner and Research Sub-agents never do: they run no git command that
  changes anything and leave their changes uncommitted.
- **When.** Only after every plan step is integrated and the final checks
  pass (`rules/high-checks-not-tests.md`). Never commit failing or
  half-integrated work.
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
- **Stage only the task's files.** `git add` the files the plan changed;
  never `git add -A` or `.`, and never stage `.dev/`, secrets or ignored
  files.
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

**Why it matters:** Pushed history is shared state every collaborator sees
and is hard to silently undo. Keeping commits to one agent, at one point
(after the final checks), authored by the human who owns the session and
free of co-author trailers, keeps the history attributable to the Lead and
reviewable. Rewriting history, merging and opening PRs stay with the Lead
because they affect other people's work, not just this task's.
