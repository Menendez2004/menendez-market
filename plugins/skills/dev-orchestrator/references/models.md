# Model per role

Each role runs on the model that fits its work, so the expensive model is
spent only where decisions are made.

| Role | Model | How it is set |
| --- | --- | --- |
| Planning (Orchestrator, Level 0) | `opusplan` | The Orchestrator session runs with `opusplan`: Opus while in plan mode, Sonnet outside it. |
| Execution (Task Agents, Level 1, and the Orchestrator outside plan mode) | latest Sonnet (`sonnet` alias) | `claude --model sonnet` in each Task Agent's launch command. |
| Inline Task Agents (small steps) | latest Sonnet (`sonnet` alias) | `model: "sonnet"` on the `Agent` call. |
| Research Sub-agents (Level 2) | Sonnet 4.6 (`claude-sonnet-4-6`) | The plugin's `orch-researcher` agent, whose definition sets `model: claude-sonnet-4-6`. |

## Orchestrator: `opusplan`

Start the Orchestrator session with:

```bash
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

The inline `Agent` tool only accepts model aliases, so a dated model such as
Sonnet 4.6 is pinned in an agent definition instead. The plugin ships
`agents/orch-researcher.md` with `model: claude-sonnet-4-6` and read-only
tools (`Read`, `Grep`, `Glob`, `Bash`). Spawn Research Sub-agents with
`subagent_type: "dev-orchestrator:orch-researcher"` and **no** `model`
parameter, because a per-call `model` overrides the definition.

If that agent type is not available (the skill was copied without the
plugin), use `subagent_type: "Explore"` with `model: "sonnet"`, and note in
the scratchpad's `## Environment` that research ran on the latest Sonnet
instead of 4.6.

Inline Task Agents pass `model: "sonnet"` explicitly, so they keep running
on the latest Sonnet.

## Other harnesses

Where a harness cannot select models per role, run with its strongest
configured model for planning and note in the scratchpad's
`## Environment` which models were actually used.
