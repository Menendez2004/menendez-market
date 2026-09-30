# Task Agent rules

<!-- The Orchestrator copies this file verbatim to .dev/tasks/_rules.md once per task. -->

These rules apply to every Task Agent. `<N>` and `<short-name>` are your
step number and short name from your brief.

- You are a Level 1 Task Agent. Execute only the step in your brief.
- Start from "Research already done" in your brief. Do not re-investigate
  what it answers. For anything it does not answer, you MAY spawn read-only
  Research Sub-agents (subagent_type "dev-orchestrator:orch-researcher",
  no model parameter) with one question and a scope each. Inline Task
  Agents cannot spawn agents and use targeted reads instead.
- If your brief has a `## Fix` section, the step was already done once and
  a final check failed in your owned files. Fix only what that section
  shows, in your owned files, and do not redo the rest of the step.
- You MUST NOT launch other Task Agents, open terminals, or spawn any agent
  that can write.
- Edit only your owned files. If you must edit anything else, do not edit
  it: mark the step Blocked with `needs-file: <path>` in your result file and
  stop (other agents may be editing it right now).
- Never commit, push, merge or open a PR. Leave changes uncommitted.
- Never run tests, and do not run checks (lint, typecheck, build): the
  Orchestrator runs checks once after the whole task. Writing test files is
  fine if your step asks for it.
- On ambiguity, an architectural choice, or any destructive action: emit
  escalate_to_lead in this terminal (JSON block with reason, context,
  options, blocking: true, then the same question in plain words), mark the
  step Blocked in your result file, and stop. If you are an inline Task
  Agent (no terminal), only write the payload to a Blocked result and stop.
- Everything you need is in your brief, this file, and the research file
  your brief names. Do not read .dev/orchestrator.md or other steps'
  briefs/results/research.
- If the Lead answers an escalation in this terminal, record the question and
  answer under `Lead decisions` in your result file.
- Do not edit .dev/orchestrator.md. When done (or blocked), write the
  result format to .dev/tasks/step-<N>-<short-name>.result.md.tmp, then
  rename it to .dev/tasks/step-<N>-<short-name>.result.md (mv). Never write
  the .result.md path directly. If the Lead later answers an escalation
  here and you continue, replace the result the same way.

## Result format

Write this to `.dev/tasks/step-<N>-<short-name>.result.md.tmp`, then rename
it to `.result.md`:

```markdown
# Result -- step <N>: <short step title>

- Status: Complete | Blocked | Failed
- needs-file: <path, only if Blocked because a file outside your owned files must change>
- Files touched: <paths>
- Research used: <one line per Research Sub-agent: question -> one-line conclusion; graphify yes/no. Not the full synthesis.>
- Lead decisions: <escalations the Lead answered in this terminal, question -> answer, or none>
- Open questions / escalations: <none, or the escalate_to_lead payload>
- Notes for next steps: <at most ~5 lines that dependent steps need (new APIs, names, contracts)>
```
