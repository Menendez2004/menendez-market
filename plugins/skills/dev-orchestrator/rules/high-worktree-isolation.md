---
title: Each Task Agent works in its own worktree; only checked patches reach the Lead's tree
impact: HIGH
tags: [worktrees, isolation, parallelism, task-agent, git]
---

**Incorrect (multi-agent, 3 steps running):**

```
All three Task Agents edit the Lead's working tree directly. Step 2 also
"fixes" an import in src/auth/session.ts, which step 1 owns and is editing
at the same moment. Step 1's next write overwrites it, step 2's code no
longer compiles, and step 3 fails half-way, leaving partial edits in the
Lead's tree that the Lead now has to find and undo by hand.
```

**Correct (same plan):**

```
For each step the Orchestrator takes a snapshot of the Lead's current
tree and creates a detached worktree from it:
  ../.app-orch/orch-s1-auth, orch-s2-ratelimit, orch-s3-docs
Each Task Agent edits only inside its worktree.

Step 2 completes. Its patch touches src/billing/limits.ts (owned) and
src/auth/session.ts (not owned): the Orchestrator does not apply it,
marks step 2 Blocked with needs-file: src/auth/session.ts, and asks the
Lead. Step 1 completes: its patch touches only owned files, passes
`git apply --check`, and is applied to the Lead's tree, uncommitted. Step 3
fails: its worktree is kept for the Lead to inspect, and the Lead's tree
never saw its partial edits.
```

**Rules:**

- In multi-agent mode, every Task Agent (terminal and inline) gets its own
  worktree created from a fresh snapshot of the Lead's working tree
  (`references/worktrees.md`). Single-session mode works in the Lead's tree.
- Worktrees are detached (no branch), live outside the project in
  `<parent>/.<project>-orch/`, and are named like the step's terminal
  (`orch-s<N>-<short-name>`).
- A Task Agent edits files only inside its worktree. It writes only its
  result file under `ROOT/.dev/tasks/`, and only reads other `ROOT` paths
  (ignored files such as the graph or generated code).
- Only `Complete` steps are integrated, one at a time: patch from the
  worktree, ownership check against the step's owned files, `git apply
  --check`, then `git apply` in the Lead's tree (never `--index` or
  `--3way`). Anything that fails a check is not applied; it is escalated.
- The Orchestrator removes only worktrees it created and recorded, and only
  after the step's patch is saved (Complete) or the Lead drops the step.
- If worktrees are not available (not a git repo, git older than 2.17, no
  commits, submodules the Lead does not want initialized), tell the Lead
  and fall back to the shared tree.

**Why it matters:** A shared working tree turns every scheduling mistake or
out-of-scope edit into silent damage in the Lead's files. Worktrees make
each step's changes a reviewable patch that is checked before it lands, and
make a failed step free to throw away.
