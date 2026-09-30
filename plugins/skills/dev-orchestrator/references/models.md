# Model per role

Each role runs on the model that fits its work, so the expensive model is
spent only where decisions are made.

| Role | Model | How it is set |
| --- | --- | --- |
| Planning (Orchestrator, Level 0) | `opusplan` | The Orchestrator session runs with `opusplan`: Opus while in plan mode, Sonnet outside it. |
| Execution (Task Agents, Level 1, and the Orchestrator outside plan mode) | latest Sonnet (`sonnet` alias) | `claude --model sonnet` in each Task Agent's launch command. |
| Research Sub-agents (Level 2) | Sonnet 4.6 (`claude-sonnet-4-6`) | `CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-4-6` with `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` in the session that spawns them. |

## Orchestrator: `opusplan`

Start the Orchestrator session with:

```bash
CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-4-6 CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1 \
  claude --model opusplan
```

or switch an open session with `/model opusplan`. If the session is not on
`opusplan` when planning is needed, ask the Lead once to switch (plain
question, not an escalation) before drafting a plan.

- Drafting a plan (`SKILL.md` step 3) happens **in plan mode**, so Opus
  writes it. There is no separate planning agent.
- Everything else the Orchestrator does (merging results, writing briefs,
  single-session execution, final checks) happens outside plan mode, on
  Sonnet.

## Task Agents: latest Sonnet

The launch command in `references/terminal-launch.md` pins every Task Agent
to `--model sonnet`, which resolves to the latest Sonnet. Do not use a
dated model ID here: the alias keeps Task Agents current without editing
the skill.

## Research Sub-agents: Sonnet 4.6

The inline `Agent` tool only accepts model aliases, and built-in read-only
types such as `Explore` carry their own default model. To pin Research
Sub-agents to Sonnet 4.6, the spawning session sets:

```bash
CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-4-6
CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1
```

`FORCE` makes it override both the subagent type's own model and any
`model` parameter, so every inline agent in that session runs on Sonnet 4.6.
This is safe because the only inline agents in this skill are Research
Sub-agents. Do not pass a `model` parameter on the `Agent` call.

Both the Task Agent launch command and the Orchestrator start command above
set these variables, so this holds in multi-agent and single-session mode.

## Other harnesses

Where a harness cannot select models per role, run with its strongest
configured model for planning and note in the scratchpad's
`## Environment` which models were actually used.
