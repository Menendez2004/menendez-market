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
  (`orchestrator-tasks/step-[N]-[short-name].md`), the result file and the
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

Shared variables (run from the project root):

```bash
NAME="orch-s2-ratelimit"
BRIEF="orchestrator-tasks/step-2-ratelimit.md"
CMD="claude 'Read $BRIEF and execute it exactly as written.'"
```

| Terminal | Command |
| --- | --- |
| tmux | `tmux new-window -n "$NAME" -c "$PWD" "$CMD"` |
| Zellij | `zellij action new-tab --name "$NAME" --cwd "$PWD"` then `zellij action write-chars "$CMD"` + Enter (or `zellij run --name "$NAME" --cwd "$PWD" -- sh -c "$CMD"` for a pane) |
| kitty | `kitty @ launch --type=tab --tab-title "$NAME" --cwd "$PWD" sh -c "$CMD"` (needs `allow_remote_control yes`) |
| WezTerm | `PANE=$(wezterm cli spawn --cwd "$PWD" -- sh -c "$CMD") && wezterm cli set-tab-title --pane-id "$PANE" "$NAME"` |
| iTerm2 | AppleScript snippet below |
| macOS Terminal | AppleScript snippet below |
| Windows Terminal | `wt -w 0 new-tab --title "$NAME" -d . <shell> -c "$CMD"` (e.g. `pwsh -NoExit -Command`) |
| Konsole | `konsole --new-tab --workdir "$PWD" -p tabtitle="$NAME" -e sh -c "$CMD"` |
| GNOME Terminal | `gnome-terminal --tab --title="$NAME" --working-directory="$PWD" -- sh -c "$CMD; exec \$SHELL"` |
| Alacritty | `alacritty msg create-window --working-directory "$PWD" --title "$NAME" -e sh -c "$CMD"` (falls back to `alacritty --title ... -e ...`) |
| VS Code / Cursor, Ghostty, unknown | See fallback below. |

macOS (iTerm2 / Terminal) via AppleScript:

```bash
LINE="cd '$PWD'; printf '\\033]0;%s\\007' '$NAME'; $CMD"

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
   `tmux new-session -d -s "$NAME" -c "$PWD" "$CMD"` ->
   "Run `tmux attach -t $NAME` in a new terminal to watch step N."
2. Otherwise, print the exact command (`cd <project> && <CMD>`) and ask the
   Lead to open a new terminal named `$NAME` and paste it. Wait for the
   result file as usual.

Never fall back to running the step inline in the Orchestrator's own session
without the Lead agreeing to switch to single-session mode.

## 5. Waiting for completion

The Orchestrator waits for `orchestrator-tasks/step-[N]-[short-name].result.md` to
exist (poll with a reasonable interval, or use the harness's background
monitor). Then it reads the result, merges it into the scratchpad, and
either launches the next step or, if `Status: Blocked`, surfaces the
escalation to the Lead and halts.
