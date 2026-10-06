---
title: Always open a new terminal for a Task Agent; never kill the Orchestrator's terminal
impact: CRITICAL
tags: [terminal, multi-agent, hitl]
---

**Incorrect (multi-agent mode, tmux, step 2 is ready):**

```
The Orchestrator wants step 2 to start fast, so it runs

  tmux send-keys "cd $DIR && $CMD" Enter        # types into its own pane
  # or: exec claude ...                         # replaces its own shell
  # or: tmux respawn-pane -k "$CMD"              # kills its own pane

and later, to "clean up", runs `tmux kill-session` on the session it is
running in.
```

The Orchestrator's session dies or is replaced: the scratchpad stops being
updated, the waits for results are lost, and the Lead loses the
conversation that owns the plan.

**Correct (same situation):**

```
The Orchestrator records its own terminal once in `## Environment`
(e.g. `Orchestrator terminal: tmux pane %3, window 1, session dev`), then
opens a NEW window for the step:

  tmux new-window -n orch-s2-ratelimit -c "$DIR" "$CMD"

and keeps working in its own pane. It never closes, kills or reuses any
terminal; when a Task Agent finishes, its terminal stays open for the Lead
to read and close.
```

**Rules:**

- Every `terminal` Task Agent starts in a **new** tab, window or pane
  (`references/terminal-launch.md` section 3). Never start it in the
  Orchestrator's own terminal: no typing into the current pane
  (`send-keys`/`write-chars` without a new tab first), no `exec`, no
  `respawn-pane`, no running `claude` in the Orchestrator's shell.
- If no new terminal can be opened (section 4 fallback), use the detached
  tmux session or ask the Lead to open one. Never fall back to the
  Orchestrator's terminal.
- Never kill, close or replace the Orchestrator's terminal, tab, window,
  pane or multiplexer session: no `kill-pane`, `kill-window`,
  `kill-session`, `kill-server`, `close-pane`, `exit`, or killing its
  shell's process. This holds for cleanup, retries and relaunches too.
- The Orchestrator does not close Task Agents' terminals either: the Lead
  reads and closes them. A relaunch opens a new terminal.
- Task Agents never touch any terminal other than their own.

**Why it matters:** The Orchestrator's terminal is where the Lead talks to
it and where the whole task's state lives in memory. Losing it mid-task
orphans every running step and forces a resume from the scratchpad; a new
terminal per step costs a second and keeps every step visible.
