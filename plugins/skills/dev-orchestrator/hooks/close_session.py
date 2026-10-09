#!/usr/bin/env python3
"""Stop hook for dev-orchestrator: ends a finished Task Agent's session.

The Orchestrator starts each terminal Task Agent with ORCH_RESULT set to the
absolute path of the step's result file. When that agent's turn ends and the
result file, written during this session, says `Complete` or `Failed`, the
step is done: this hook ends the `claude` process a moment later, so the
terminal tab/window/pane it runs in closes by itself. A `Blocked` result (the
agent escalated and waits for the Lead in this terminal) or no result yet
leaves the session open.

It does nothing outside a Task Agent (no ORCH_RESULT), when ORCH_KEEP_OPEN=1,
or on platforms without `ps` (Windows). Any error exits 0 silently: it never
blocks a turn.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import time

CLOSING_STATUSES = {"complete", "failed"}
STATUS = re.compile(r"^\s*-?\s*Status:\s*\**\s*(\w+)", re.IGNORECASE | re.MULTILINE)
# Seconds between the turn ending and the session closing, so Claude Code
# finishes its own Stop handling first.
GRACE_SECONDS = 2


def result_status(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        match = STATUS.search(f.read())
    return match.group(1).lower() if match else ""


def ps(pid: int, field: str) -> str:
    out = subprocess.run(
        ["ps", "-o", f"{field}=", "-p", str(pid)],
        capture_output=True,
        text=True,
        timeout=5,
    )
    return out.stdout.strip()


def is_claude(args: str) -> bool:
    # The native binary (`claude ...`) or the npm package (`node .../claude`,
    # `node .../@anthropic-ai/claude-code/cli.js`). Only the program and its
    # first argument count: hook commands mention `.claude/` paths too.
    tokens = args.split()[:2]
    if tokens and os.path.basename(tokens[0]) == "claude":
        return True
    return (
        len(tokens) == 2
        and os.path.basename(tokens[0]).startswith("node")
        and (os.path.basename(tokens[1]) == "claude" or "@anthropic-ai/claude-code" in tokens[1])
    )


def find_claude_pid() -> int | None:
    # Claude Code runs a hook command through a shell, so its `claude` is the
    # hook's parent or grandparent; nothing further up is ever the one to end.
    pid = os.getppid()
    for _ in range(3):
        if pid <= 1:
            return None
        if is_claude(ps(pid, "args")):
            return pid
        parent = ps(pid, "ppid")
        if not parent.isdigit():
            return None
        pid = int(parent)
    return None


def main() -> int:
    result = os.environ.get("ORCH_RESULT", "")
    if not result or os.environ.get("ORCH_KEEP_OPEN") == "1" or os.name != "posix":
        return 0
    if not os.path.isfile(result) or result_status(result) not in CLOSING_STATUSES:
        return 0

    pid = find_claude_pid()
    if pid is None:
        return 0

    # A result left by an earlier attempt of the step does not count: it must
    # have been written after this session started.
    elapsed = ps(pid, "etimes")
    if not elapsed.isdigit() or os.path.getmtime(result) < time.time() - int(elapsed):
        return 0

    subprocess.Popen(
        ["sh", "-c", f"sleep {GRACE_SECONDS}; kill -TERM {pid}"],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
