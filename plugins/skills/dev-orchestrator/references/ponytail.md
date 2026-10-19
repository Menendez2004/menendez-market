# Conditional use of ponytail by code-writing agents

`ponytail` is a code-minimalism skill: before writing code it asks whether
the code needs to exist (YAGNI), prefers the standard library and native
platform features over custom code or new dependencies, and keeps
validation, error handling, security and accessibility. When it is
available, every agent that writes code in this skill uses it so steps do
not grow code the task does not need. When it is not, agents work normally
-- ponytail is never a requirement and is never installed by an agent.

The skill does not activate on its own reliably, so it is never left to
chance: the Orchestrator checks for it once and every brief says whether
to load it.

## 0. Availability check (Orchestrator, once per task)

Before the footprint research (`SKILL.md` step 4), together with the
graphify check, the Orchestrator checks in order and stops at the first hit:

1. **Skill in the harness**: a `ponytail` skill (e.g. `ponytail` or
   `ponytail:ponytail`) in the current skill list.
2. **Skill on disk**: `<ROOT>/.claude/skills/ponytail/SKILL.md` or
   `~/.claude/skills/ponytail/SKILL.md`.

Record one line in `## Environment` of the scratchpad:

- `ponytail: available (skill <name> | file <path>), level <lite | full | ultra | default>`
- `ponytail: not available` -- never install it, never ask the Lead to.

The level is the one the Lead named in the request ("ponytail ultra"), or
`default` (the skill's own default). Do not ask the Lead for it.

## 1. Who uses it

| Role | Uses ponytail |
| --- | --- |
| Orchestrator, single-session mode | Yes, before writing code for each step. |
| Task Agent (terminal or inline) | Yes, before writing code for its step. |
| Planner Agent, Research Sub-agents | No: they write no code. |

How to load it: invoke the skill by name with the `Skill` tool; if that
name is not in the agent's own skill list (a terminal session may not see
a project-level skill), read the `SKILL.md` path recorded in the
scratchpad. If neither works, continue without it and say so in the
result's `Research used` line (`ponytail: unavailable in session`). Never
mark a step Blocked for this.

## 2. Precedence -- the plan wins

ponytail decides **how little code** implements a step, never **what** the
step does:

- The step text, owned files, Lead decisions and the plan always win over
  ponytail. Never drop, shrink or reinterpret part of a step because
  ponytail calls it unnecessary.
- Never remove validation, error handling, security checks, accessibility,
  or tests/test files the step asks for.
- Do not delete or simplify existing code outside what the step changes:
  that is another step's work, and possibly destructive.
- If ponytail concludes that the step, or part of it, should not be built,
  or that a native/stdlib option would change a contract other steps rely
  on, that is a decision for the Lead: escalate (`rules/critical-ask-the-lead.md`;
  Task Agents through a Blocked result) instead of skipping it.
- If the step names a dependency or an approach, follow the step even
  when ponytail would avoid it.

## 3. What goes back

The Task Agent's result notes `ponytail: yes/no` in its `Research used`
line, so the Lead can tell which steps were written under it.
