---
title: Textual and semantic conflicts with what the target changed
impact: CRITICAL
tags:
  - merge
  - conflicts
  - git
---

## Rule

### Textual
Take them from `merge_probe.py` (`git merge-tree --write-tree`) or from
the merge in the temp worktree. For each conflicted file: the hunks from
both sides, the commit on the target that introduced its side
(`git log <base>..<target> -- <file>`), and which intent must survive.
Do not resolve them in the user's tree.

### Semantic (no textual conflict, still broken)
Search both directions:

1. **Target → source**: for every symbol, route, column, config key,
   event or type the source *uses*, check whether the target changed it
   since the base (renamed, removed, new required argument, changed return
   type or behavior, moved file). `git diff <base>..<target>` restricted to
   the files that define them, plus `git log -S<name> <base>..<target>`.
2. **Source → target**: for every symbol the source *changes*, check
   whether code added on the target since the base uses it (that code was
   written against the old behavior and the branch has never seen it).
   `git grep <name> <target-sha>` vs. `git grep <name> <base>`.
3. Parallel additions: two migrations with the same number/timestamp, two
   routes on the same path, the same config key with different defaults,
   duplicate enum values, both sides bumping the same dependency.

Overlap files (changed on both sides) from the probe are where to start,
not where to stop.

**Incorrect:**

```markdown
Conflicts: none (git merge-tree is clean).
```

**Correct:**

```markdown
Textual: none.
Semantic:
- S1 `develop` renamed `calcTotal` → `computeTotal` (`cart/pricing.ts:18`, a1b2c3d, 3 commits after the base);
  the source calls `calcTotal` at `coupons/apply.ts:22` and `coupons/preview.ts:9`. Merged typecheck: TS2305.
- S2 both sides add migration `20261101120000_*` (`db/migrations/`): ordering is undefined.
```

**Why it matters:** Git only sees lines. Most "it passed CI and broke
after merge" incidents are semantic conflicts.
