# Launching Task Agents in the user's terminal

In multi-agent mode every Task Agent runs as an independent CLI session in a
**new terminal tab/window/pane of the terminal the user is actually using**,
so the Lead can watch and interact with each step where they already work.

## 1. Naming (mandatory)

```
orch-s[N]-[short-name]
```

- `[N]`: the plan step number (1-based, no padding).
- `[short-name]`: 1-2 words from the step title, lowercase kebab-case,
  ASCII only, max ~10 chars, so the whole name stays around 10-15 chars and
  fits in a tab title. Examples: `orch-s1-auth`, `orch-s3-migrate`.
- Use the same name for the terminal title, the brief file
  (`.dev/tasks/step-[N]-[short-name].md`), the result file and the
  scratchpad entry.

## 2. Detect the user's terminal

Inspect the environment of the Orchestrator's own shell, **in this order**
(multiplexers first, because they run inside another terminal and are what
the user is really interacting with):

| Check | Terminal |
| --- | --- |
| `$TMUX` set | tmux |
| `$ZELLIJ` set | Zellij |
| `$KITTY_WINDOW_ID` set | kitty |
| `$WEZTERM_PANE` set or `$TERM_PROGRAM=WezTerm` | WezTerm |
| `$TERM_PROGRAM=iTerm.app` | iTerm2 |
| `$TERM_PROGRAM=Apple_Terminal` | macOS Terminal |
| `$TERM_PROGRAM=vscode` | VS Code / Cursor integrated terminal |
| `$TERM_PROGRAM=ghostty` | Ghostty |
| `$WT_SESSION` set | Windows Terminal |
| `$KONSOLE_VERSION` set | Konsole |
| `$GNOME_TERMINAL_SCREEN` set | GNOME Terminal |
| `$ALACRITTY_WINDOW_ID` / `$ALACRITTY_SOCKET` set | Alacritty |

A quick probe:

```bash
env | grep -E '^(TMUX|ZELLIJ|KITTY_WINDOW_ID|WEZTERM_PANE|TERM_PROGRAM|WT_SESSION|KONSOLE_VERSION|GNOME_TERMINAL_SCREEN|ALACRITTY_(WINDOW_ID|SOCKET))='
```

Record the detected terminal in the scratchpad (`## Environment`) once, and
reuse it for every step. If detection is ambiguous, ask the Lead once
(plain question, not an escalation) which terminal to use.

## 3. Launch command per terminal

Shared variables (run from the project root, after creating the step's
worktree, `references/worktrees.md` section 4):

```bash
ROOT="$(git rev-parse --show-toplevel)"
NAME="orch-s2-ratelimit"
DIR="$WTROOT/$NAME"                      # the step's worktree; "$ROOT" if worktrees are off
BRIEF="$ROOT/.dev/tasks/step-2-ratelimit.md"
CMD="claude 'Read $BRIEF and execute it exactly as written.' --model sonnet --add-dir '$ROOT/.dev'"
```

The Task Agent starts **in its worktree** (`DIR`), so its edits and its
Research Sub-agents' searches stay there. `--add-dir` lets it read the
brief, rules and decisions and write its result under `ROOT/.dev` without
giving it the rest of the Lead's tree. If the step must read ignored files
from `ROOT` (for example `graphify-out/`), add that directory with another
`--add-dir`. Keep the prompt **before** `--add-dir`: the option takes
several paths and would swallow a prompt placed after it. With worktrees
off, `DIR="$ROOT"` and `--add-dir` is not needed.

`--model sonnet` runs the Task Agent on the latest Sonnet. Its Research
Sub-agents get Sonnet 4.6 from their own agent definition
(`references/models.md`), so nothing else goes on the command line.

| Terminal | Command |
| --- | --- |
| tmux | `tmux new-window -n "$NAME" -c "$DIR" "$CMD"` |
| Zellij | `zellij action new-tab --name "$NAME" --cwd "$DIR"` then `zellij action write-chars "$CMD"` + Enter (or `zellij run --name "$NAME" --cwd "$DIR" -- sh -c "$CMD"` for a pane) |
| kitty | `kitty @ launch --type=tab --tab-title "$NAME" --cwd "$DIR" sh -c "$CMD"` (needs `allow_remote_control yes`) |
| WezTerm | `PANE=$(wezterm cli spawn --cwd "$DIR" -- sh -c "$CMD") && wezterm cli set-tab-title --pane-id "$PANE" "$NAME"` |
| iTerm2 | AppleScript snippet below |
| macOS Terminal | AppleScript snippet below |
| Windows Terminal | `wt -w 0 new-tab --title "$NAME" -d "$DIR" <shell> -c "$CMD"` (e.g. `pwsh -NoExit -Command`) |
| Konsole | `konsole --new-tab --workdir "$DIR" -p tabtitle="$NAME" -e sh -c "$CMD"` |
| GNOME Terminal | `gnome-terminal --tab --title="$NAME" --working-directory="$DIR" -- sh -c "$CMD; exec \$SHELL"` |
| Alacritty | `alacritty msg create-window --working-directory "$DIR" --title "$NAME" -e sh -c "$CMD"` (falls back to `alacritty --title ... -e ...`) |
| VS Code / Cursor, Ghostty, unknown | See fallback below. |

macOS (iTerm2 / Terminal) via AppleScript:

```bash
LINE="cd '$DIR'; printf '\\033]0;%s\\007' '$NAME'; $CMD"

# iTerm2
osascript <<OSA
tell application "iTerm2"
  tell current window
    create tab with default profile
    tell current session to write text "$LINE"
  end tell
end tell
OSA

# macOS Terminal
osascript -e "tell application \"Terminal\" to do script \"$LINE\""
```

Keep `$CMD` free of double quotes (use single quotes, as above) so it can be
interpolated into the AppleScript string safely.

Notes:
- Keep the session open after the agent finishes (`exec $SHELL` or the
  terminal's hold option) so the Lead can read the transcript.
- Quote carefully: the brief path is the only argument the Task Agent
  needs; never inline chat history into the command.
- If a command fails (remote control disabled, binary missing), try the
  fallback instead of switching to a different terminal app.

## 4. Fallback (no scriptable way to open a tab)

VS Code/Cursor integrated terminals and some emulators cannot be driven from
a shell. In that case:

1. If `tmux` is installed, start a detached session and tell the Lead how to
   attach:
   `tmux new-session -d -s "$NAME" -c "$DIR" "$CMD"` ->
   "Run `tmux attach -t $NAME` in a new terminal to watch step N."
2. Otherwise, print the exact command (`cd <DIR> && <CMD>`) and ask the
   Lead to open a new terminal named `$NAME` and paste it. Wait for the
   result file as usual.

Never fall back to running the step inline in the Orchestrator's own session
without the Lead agreeing to switch to single-session mode.

## 5. Waiting for results

### Result files are written atomically

A Task Agent writes its result to
`.dev/tasks/step-[N]-[short-name].result.md.tmp` and then renames it to
`.result.md` (`mv` is atomic on the same filesystem). The Orchestrator
therefore never reads a half-written result: if `.result.md` exists, it is
complete. The same applies when a Task Agent replaces its result after the
Lead answers an escalation.

### Wait in the background, not in the conversation

Do not check the files turn after turn. Start one background command that
exits as soon as **any** running step produces a new result, and let the
harness wake you when it exits (in Claude Code: `Bash` with
`run_in_background: true`, or the `Monitor` tool):

```bash
# One path per running or held step; exits with the first result not merged yet.
while :; do
  for f in .dev/tasks/step-2-routes.result.md .dev/tasks/step-4-docs.result.md; do
    [ -f "$f" ] && { [ ! -f "$f.merged" ] || [ "$f" -nt "$f.merged" ]; } \
      && { echo "$f"; exit 0; }
  done
  sleep 5
done
```

After merging a result, `touch <result>.merged`. A result counts as new
while it has no `.merged` marker or is newer than it, so nothing that lands
between two waits is missed, and a result replaced after an escalation is
picked up again.

When it exits: merge that result into the scratchpad, touch its marker, apply the launch rule
(`references/parallelization.md` section 3), and start a new wait over the
steps still running. Blocked and failed steps follow
`references/parallelization.md` section 5: only their dependents are held.

## 6. Inline runner for small steps

Opening a terminal and starting a full CLI session has a fixed cost that
dominates a small step. A step the dependency map marks **inline**
(`references/parallelization.md` section 1) skips the terminal:

- The Orchestrator creates the step's worktree like for any other step
  (`references/worktrees.md` section 4), writes the same brief file and
  starts the Task Agent with the inline `Agent` tool (a general-purpose
  type that can edit), `model: "sonnet"`, `run_in_background: true`, no
  `isolation` parameter (the Orchestrator's own worktree replaces it), and
  a prompt of "Read <absolute brief path> and execute it exactly as
  written. Work only inside <worktree path>. Reply only with
  `done: <result path>`." Its reply lands in the Orchestrator's own
  context, so it must stay one line; everything else goes in the result
  file, which the Orchestrator reads like any other.
- It is still a Level 1 Task Agent with the same brief, owned files, rules
  and result file. The only differences: no terminal name, and it cannot
  spawn Research Sub-agents (inline agents cannot nest), so it relies on
  `.dev/research/` and its own targeted reads.
- It cannot talk to the Lead directly. On anything that needs the Lead, it
  writes a `Blocked` result with the `escalate_to_lead` payload and stops;
  the Orchestrator escalates in the main session, logs the answer in
  `.dev/tasks/_decisions.md`, and relaunches the step (inline or in a
  terminal) with a `## Previous attempt` section holding the answer.
- Record it in the scratchpad as `Runner: inline`.

If an inline step turns out bigger than expected (it needs research or
several escalations), relaunch it in a terminal instead.
