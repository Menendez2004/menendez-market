#!/usr/bin/env python3
"""UserPromptSubmit hook for dev-orchestrator.

Gives the dev-orchestrator skill explicit priority, without the user having
to invoke it, when a prompt asks for a plan or for multi-step dev work, or
when the session is in plan mode. It injects a routing instruction as
additional context; it never blocks a prompt. Any error exits 0 silently.
"""

import json
import re
import sys

PLAN_INTENT = re.compile(
    r"""
    \b(create|make|write|draft|build|design|prepare|give\s+me|come\s+up\s+with)\b.{0,40}\bplan\b
    | \bplan\s+(out|for|how|this|the|a|an)\b
    | \bimplementation\s+plan\b
    | \bmulti[-\s]?step\b
    | \borchestrat
    | \bdev[-\s]?orchestrator\b
    | \b(crea|crear|cr[eé]ame|haz|hacer|hazme|arma|armar|genera|generar|escribe|escribir
         |prepara|preparar|dame|dise[nñ]a|dise[nñ]ar|elabora|elaborar|redacta|redactar)\b.{0,40}\bplan\b
    | \bplanific
    | \bplane(a|ar|emos|alo)\b
    | \bplan\s+de\s+(trabajo|implementaci[oó]n|acci[oó]n|desarrollo)\b
    | \borquest
    """,
    re.IGNORECASE | re.VERBOSE,
)

ROUTING = """<dev-orchestrator-routing priority="required">
This prompt asks for a plan or for multi-step development work{why}. The
dev-orchestrator plugin is installed and has priority over your general
knowledge and over planning on your own.

- Your FIRST action MUST be to invoke the Skill tool with the
  `dev-orchestrator` skill (listed as `dev-orchestrator:dev-orchestrator`
  or `dev-orchestrator`), then follow it.
- Do NOT draft the plan yourself, and do NOT use the built-in `Plan` or
  `Explore` agents for planning. When no plan is provided, the skill drafts
  it with the `dev-orchestrator:orch-planner` agent (Opus, read-only).
- Research goes through `dev-orchestrator:orch-researcher` (Sonnet 5,
  read-only), never a model chosen per call.
- If the Lead's prompt already contains a plan, the skill adopts it as is.

Ignore this only if the prompt is a plain question that asks for no work
(for example, explaining what a plan is).
</dev-orchestrator-routing>"""


def is_task_agent(prompt: str, cwd: str) -> bool:
    # Task Agents launched by the orchestrator run in orch-sN worktrees on a
    # brief under .dev/tasks/; they must execute their step, not re-plan.
    return "/.dev/tasks/" in prompt or ".dev/tasks/step-" in prompt or re.search(
        r"-orch/orch-s\d+", cwd or ""
    ) is not None


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0

    prompt = (data.get("prompt") or "").strip()
    cwd = data.get("cwd") or ""
    in_plan_mode = data.get("permission_mode") == "plan"

    # Slash commands load their own skill; Task Agents never re-plan.
    if not prompt or prompt.startswith("/") or is_task_agent(prompt, cwd):
        return 0

    if not (in_plan_mode or PLAN_INTENT.search(prompt)):
        return 0

    why = " (the session is in plan mode)" if in_plan_mode else ""
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": ROUTING.format(why=why),
            }
        },
        sys.stdout,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
