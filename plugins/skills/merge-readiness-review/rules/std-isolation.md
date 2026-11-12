---
title: Isolation — temp worktree only; never merge, push, rebase or commit
impact: CRITICAL
tags:
  - safety
  - git
  - read-only
---

## Rule

The review never changes the user's branches or working tree.

- Allowed: `git fetch`, `git log/diff/show/blame/merge-base/merge-tree`,
  `git worktree add --detach <tmp> <sha>`, `git merge --no-commit` **inside
  that worktree**, installing dependencies and running checks **inside
  that worktree**, creating `refs/merge-review/*` for a fetched PR.
- Not allowed: `git checkout`/`switch` in the user's tree, `git merge`,
  `rebase`, `reset`, `commit`, `push`, `stash`, `cherry-pick` on any real
  branch; `--fix` flags; formatters; editing files in the user's tree.
- The temp worktree lives in the session scratchpad or a `mktemp -d`
  directory, never inside the repo. Remove it at the end, even on failure:
  `git -C "$WT" merge --abort; git worktree remove --force "$WT"; git worktree prune`,
  and delete the `refs/merge-review/*` refs you created.
- The only file written in the repo is the report, in `.dev/merge-review/`.
- Fixes happen only in step 8, when the user asks, on the source branch.

**Incorrect:**

```bash
git checkout main && git merge feat/coupons      # merges for real
npm run lint -- --fix
```

**Correct:**

```bash
WT="$(mktemp -d)/merge-review-feat-coupons"
git worktree add --detach "$WT" "$TARGET_SHA"
git -C "$WT" merge --no-ff --no-commit "$SOURCE_SHA"
(cd "$WT" && npm ci && npm run lint)
git -C "$WT" merge --abort; git worktree remove --force "$WT"; git worktree prune
```

**Why it matters:** The user asked "can this be merged?", not "merge it".
A review that leaves a half-merged branch, a moved HEAD or a stray
worktree is itself a breakage.
