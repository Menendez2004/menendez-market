# Model per role

Each role runs on the model that fits its work, so the expensive model is
spent only where decisions are made.

| Role | Model | How it is set |
| --- | --- | --- |
| Planning (Planner Agent, Level 1) | Opus (`opus` alias) | The plugin's `orch-planner` agent, whose definition sets `model: opus` and read-only tools. |
| Orchestrator (Level 0) | latest Opus (`opus` alias) | `claude --model opus` or `/model opus`. It executes the steps itself in single-session mode, so it runs on the execution model. |
| Execution (Task Agents, Level 1) | latest Opus (`opus` alias) | `claude --model opus` in each Task Agent's launch command. |
| Inline Task Agents (small steps) | latest Opus (`opus` alias) | `model: "opus"` on the `Agent` call. |
| Research Sub-agents (Level 2) | Sonnet 5 (`claude-sonnet-5-5`) | The plugin's `orch-researcher` agent, whose definition sets `model: claude-sonnet-5-5`. |

## Planner Agent: Opus

Planning always goes to a dedicated agent on the latest Opus. A plan-mode
setting cannot be given to an agent, so the planner pins `model: opus` and
gets only read-only tools (`Read`, `Grep`, `Glob`, `Bash`), which is what
plan mode guarantees.

Spawn it with `subagent_type: "dev-orchestrator:orch-planner"` and **no**
`model` parameter, whether or not the session is in plan mode (the `Agent`
tool works in plan mode). Do not run the Orchestrator session on
`opusplan`: outside plan mode it falls back to Sonnet, and the Orchestrator
executes steps itself in single-session mode. If the session is not on
Opus when execution starts, ask the Lead once to switch (`/model opus`).

If that agent type is not available (the skill was copied without the
plugin), use `subagent_type: "Plan"` with `model: "opus"` and note it in
the scratchpad's `## Environment`.

## Task Agents: latest Opus

The launch command in `references/terminal-launch.md` pins every Task Agent
to `--model opus`, which resolves to the latest Opus. Do not use a
dated model ID here: the alias keeps Task Agents current without editing
the skill.

## Research Sub-agents: Sonnet 5

The inline `Agent` tool only accepts model aliases, so a specific model such
as Sonnet 5 is pinned in an agent definition instead. The plugin ships
`agents/orch-researcher.md` with `model: claude-sonnet-5-5` and read-only
tools (`Read`, `Grep`, `Glob`, `Bash`). Spawn Research Sub-agents with
`subagent_type: "dev-orchestrator:orch-researcher"` and **no** `model`
parameter, because a per-call `model` overrides the definition.

If that agent type is not available (the skill was copied without the
plugin), use `subagent_type: "Explore"` with `model: "sonnet"`, and note in
the scratchpad's `## Environment` that research ran on the latest Sonnet
instead of Sonnet 5.

Inline Task Agents pass `model: "opus"` explicitly, so they run on the
latest Opus like terminal Task Agents.

## Other harnesses

Where a harness cannot select models per role, run with its strongest
configured model for planning and note in the scratchpad's
`## Environment` which models were actually used.
