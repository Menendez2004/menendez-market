# Worktree isolation for Task Agents

In multi-agent mode every Task Agent works in its **own git worktree**, a
separate checkout of the project, instead of the Lead's working tree. The
Orchestrator creates the worktree, the Task Agent edits only inside it, and
when the step is `Complete` the Orchestrator turns the worktree's changes
into a patch, checks it, and applies it to the Lead's working tree. The
changes land there uncommitted, exactly as before; the Lead still commits.

Why:

- Parallel steps never see each other's half-written files, and a step that
  edits a file it does not own cannot clobber another step's work: the
  patch is checked against its owned files before it is applied.
- The Lead's working tree only ever receives finished, checked steps. A
  `Failed` or abandoned step leaves nothing behind in it.
- A relaunch starts from a clean copy plus that step's own earlier work,
  not from whatever other steps left in the shared tree.

Single-session mode does not use worktrees: the Orchestrator edits the
Lead's working tree directly, as before.

## 1. Preconditions and fallback

Check once per task, before the first launch, and record the result in the
scratchpad's `## Environment` (`Worktrees: on | off (<reason>)`):

| Check | If it fails |
| --- | --- |
| `git rev-parse --is-inside-work-tree` | Not a git repo: worktrees off |
| `git --version` is 2.17 or newer (`git worktree remove`) | Worktrees off |
| `git rev-parse HEAD` succeeds (repo has at least one commit) | Worktrees off |
| No `.gitmodules`, or the Lead agrees to `git -C <wt> submodule update --init` per worktree | Ask the Lead once |
| No merge, rebase or cherry-pick in progress in the Lead's tree | Ask the Lead to finish it first |

With worktrees off, tell the Lead once and fall back to the shared working
tree; `rules/high-parallel-disjoint-writes.md` then is the only protection.

## 2. Layout

Worktrees live **outside** the project, in a sibling directory, so the
Lead's linters, type checkers, test watchers, file indexers and graphify
never scan duplicate copies of the code:

```
<parent>/
  <project>/                      # the Lead's working tree (ROOT)
    .dev/                         # briefs, results, patches (unchanged)
  .<project>-orch/                # WTROOT, created by the Orchestrator
    orch-s1-auth/                 # one worktree per running step,
    orch-s2-ratelimit/            # named like its terminal
```

```bash
ROOT="$(git rev-parse --show-toplevel)"
WTROOT="$(dirname "$ROOT")/.$(basename "$ROOT")-orch"
NAME="orch-s2-ratelimit"
WT="$WTROOT/$NAME"
```

Record `ROOT` and `WTROOT` in `## Environment`, and each step's worktree
path and base snapshot in its handoff.

A worktree contains only files git knows about. Ignored files such as
`node_modules/`, `.env`, build output and `graphify-out/` are **not** in
it. Task Agents do not run builds, tests or checks, so they do not need
them; when a step must read one (generated types, the graph), it reads it
from `ROOT`, read-only.

## 3. Snapshot: the base of every worktree

A worktree must start from the Lead's **current** working tree, including
uncommitted edits and the changes of every step already integrated, not
from `HEAD`. The Orchestrator captures that state as a snapshot commit
object built from a temporary index:

```bash
snapshot() {
  local idx tree
  idx="$(mktemp)"
  GIT_INDEX_FILE="$idx" git -C "$ROOT" read-tree HEAD &&
  GIT_INDEX_FILE="$idx" git -C "$ROOT" add -A &&
  GIT_INDEX_FILE="$idx" git -C "$ROOT" rm -r -q --cached --ignore-unmatch .dev &&
  tree="$(GIT_INDEX_FILE="$idx" git -C "$ROOT" write-tree)" &&
  git -C "$ROOT" -c user.name=dev-orchestrator -c user.email=dev-orchestrator@localhost \
    commit-tree "$tree" -p HEAD -m "dev-orchestrator snapshot"
  local rc=$?; rm -f "$idx"; return $rc
}
BASE="$(snapshot)"
```

- It includes tracked changes and new untracked files, respects
  `.gitignore`, and always leaves `.dev/` out (whether `.dev/` is ignored or
  tracked).
- It does **not** touch the Lead's index, branches, `HEAD`, stash or
  remote. The commit object is on no branch; git garbage-collects it later.
  This is not a commit in the sense of `rules/critical-no-autonomous-git.md`.
- Do not use `claude --worktree`, the `Agent` tool's `isolation: "worktree"`
  or `git stash`: the first two start from `HEAD` (missing uncommitted and
  integrated work) and create branches; `git stash` changes the Lead's
  refs and working tree.

## 4. Create the worktree

Take a new snapshot for every launch (so the step sees every step completed
before it), then:

```bash
mkdir -p "$WTROOT"
git -C "$ROOT" worktree add --quiet --detach "$WT" "$BASE"
```

`--detach` means no branch is created. If `$WT` already exists from an
earlier attempt, follow section 7 instead.

The brief tells the Task Agent its worktree path and gives every `.dev/`
path as an absolute path under `ROOT` (see `references/agent-hierarchy.md`).
Launch commands run in `$WT` and grant access to `ROOT/.dev` (see
`references/terminal-launch.md`).

## 5. Integrate a `Complete` step

When a `Complete` result arrives, before merging it into the scratchpad:

```bash
P="$ROOT/.dev/tasks/step-2-ratelimit.patch"
git -C "$WT" add -A                                  # the worktree's own index
git -C "$WT" diff --cached --name-status "$BASE"     # files the step changed
git -C "$WT" diff --cached --binary "$BASE" > "$P"
git -C "$ROOT" apply --check "$P" && git -C "$ROOT" apply "$P"
```

1. **Ownership check.** Compare the `--name-status` list with the step's
   owned files. Any path outside them means the step broke its contract:
   do not apply. Treat it as `Blocked` with `needs-file: <paths>` and ask
   the Lead whether to extend the step's ownership (once no running step
   owns those paths) or relaunch the step to keep only its owned files.
2. **Apply check.** `git apply --check` fails only if those files changed in
   the Lead's tree after the snapshot (the Lead edited them, or a scheduling
   mistake). Do not apply, do not force it, keep the worktree and the
   patch, and escalate with the failing paths. Never use `--3way` or
   `--index`: they stage changes in the Lead's index.
3. **Apply.** `git apply` writes the changes to the Lead's working tree
   only, uncommitted and unstaged, as if the Task Agent had edited them in
   place.
4. Record `Integrated: <patch path>` in the step's handoff, then merge the
   result as usual.
5. Remove the worktree (section 8). The patch stays in `.dev/tasks/` as the
   record of what the step changed.

Integrate results one at a time, in the order they arrive; each apply
updates `ROOT` before the next step's snapshot is taken.

## 6. `Blocked` and `Failed` steps

Do not integrate anything from a step that is not `Complete`. Keep its
worktree: it holds the partial work, isolated from the Lead's tree. Show
the Lead `git -C "$WT" status --short` when escalating.

If the Lead decides to drop the step's work, remove the worktree (section
8). The Lead's tree needs no cleanup, because nothing was applied.

## 7. Relaunching a step

A relaunch (needs-file resolved, `## Fix`, an inline escalation answered,
resume after a crash) starts from a **fresh** worktree, so it also sees
every step integrated since the first attempt:

```bash
OLD="$WT"
PARTIAL="$ROOT/.dev/tasks/step-2-ratelimit.attempt-1.patch"
git -C "$OLD" add -A && git -C "$OLD" diff --cached --binary "$OLD_BASE" > "$PARTIAL"
git -C "$ROOT" worktree remove --force "$OLD"
BASE="$(snapshot)"
git -C "$ROOT" worktree add --quiet --detach "$WT" "$BASE"
git -C "$WT" apply --check "$PARTIAL" && git -C "$WT" apply "$PARTIAL"
```

If the partial patch does not apply on the fresh base, keep it, launch on
the fresh worktree without it, and put `git apply --stat` of the partial
patch in the brief's `## Previous attempt` so the Task Agent redoes that
work deliberately. A `## Fix` relaunch after integration has no partial
patch: its earlier work is already in the snapshot.

## 8. Cleanup

The Orchestrator removes **only** worktrees it created under `WTROOT` and
recorded in the scratchpad, never any other worktree:

```bash
git -C "$ROOT" worktree remove --force "$WT"   # after integration, or when the Lead drops the step
git -C "$ROOT" worktree prune                  # at the end of the task
rmdir "$WTROOT" 2>/dev/null || true            # only if empty
```

`--force` is needed because the worktree holds uncommitted changes; by then
they are saved in a patch (Complete) or the Lead chose to drop them.

## 9. Resume after an interruption

`git -C "$ROOT" worktree list` shows every worktree still on disk. For each
step that has a brief but no merged result:

- Worktree present -> its partial work is safe there. Show the Lead
  `git -C "$WT" status --short` and ask whether to relaunch on top of it
  (section 7) or drop it (section 8).
- Worktree missing -> nothing from that step reached the Lead's tree;
  relaunch it from a fresh snapshot.
- A worktree under `WTROOT` that no step in the scratchpad owns -> report it
  to the Lead; do not remove it.
