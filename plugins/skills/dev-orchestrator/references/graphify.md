# Conditional use of graphify by Research Sub-agents

`graphify` builds a knowledge graph of a codebase (AST, imports, calls,
relations between components) so an agent can answer "what depends on X?"
or "how does A reach B?" without reading every file. When it is available,
it is the fastest way for a Research Sub-agent to map a change's blast
radius. When it is not, the Sub-agent works normally -- graphify is never a
requirement and is never installed by an agent.

## 0. Build the graph once, at the start (Orchestrator)

Research Sub-agents are read-only, so they can never build a graph. Without
this step, a project that has the graphify CLI but no graph never benefits
from it. So, before the footprint research (`SKILL.md` step 4), the
Orchestrator checks once:

- `graphify-out/` exists -> use it; record `graphify: existing graph`.
- No graph, but a graphify skill/MCP tool or the `graphify` CLI is
  available -> ask the Lead once (plain question, not an escalation):
  "graphify is available but there is no graph. Build it now in
  graphify-out/ so every agent can use it?" If yes, the Orchestrator builds
  it with the command from `graphify --help` (or the skill's usage), makes
  sure `graphify-out/` is in `.gitignore` (or the Lead confirms it should be
  tracked), and records `graphify: built by Orchestrator on <date>`. If no,
  record `graphify: available, no graph (Lead declined)` and do not ask
  again in this task.
- Nothing available -> record `graphify: not available`. Never install it.

The graph is not rebuilt as steps change the code, so it goes stale as
steps complete. To keep that from misleading agents, every Research
Sub-agent brief written after a step has completed lists "Files changed
since the graph was built" (the Files touched of completed steps). Graph
edges that touch those files are not trusted: the sub-agent reads those
files directly instead. Rebuild only if the Lead asks.

## 1. Availability check (always first)

Before any manual search or bulk reading, a Research Sub-agent checks, in
order, and stops at the first hit:

1. **Existing graph in the project**: a `graphify-out/` directory (e.g.
   `graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md`) at the project
   root.
2. **Tooling in the harness**: a `graphify` skill/slash command or a
   graphify MCP tool in the current tool list.
3. **CLI on the system**: `command -v graphify` succeeds.

If none is found, record "graphify: not available" in the synthesis and
continue with targeted `grep`/`glob`/reads.

## 2. How to use it (read-only)

- **Prefer an existing graph.** Read `GRAPH_REPORT.md` for the overview and
  query `graph.json` (or the graphify query commands) for the specific
  files, symbols and edges relevant to the question.
- **Query, don't dump.** Ask focused questions (neighbors of a module, the
  path between two components, who imports a symbol). Check the tool's own
  help (`graphify --help` or the skill's usage) for the exact query syntax
  rather than guessing flags.
- **Building a graph writes files.** A Research Sub-agent is read-only, so
  it must not create or rebuild `graphify-out/`. If no graph exists and only
  the CLI is available (the Lead declined the build in section 0), it may
  run graphify only in a mode that writes nothing to the project (e.g. an
  output directory under the system temp dir); otherwise it reports
  "graphify available but no graph built". The Lead already decided about
  the build in section 0, so nobody asks again.
- **Verify before relying on it.** Graph edges can be stale. Confirm any
  relation the Task Agent will act on with a direct read of the file
  (`path:line`).

## 3. What goes back to the Task Agent

The synthesis states:
- whether graphify was used (and which source: existing graph, skill/MCP,
  CLI) or not available,
- the relevant nodes/edges it found (files, modules, symbols),
- anything it could not confirm by direct reading.

## Why this is conditional

Different projects and machines have different tooling. Making graphify
mandatory would break the skill wherever it is missing; ignoring it where it
exists wastes the Task Agent's time and context on manual exploration. So
the rule is: **check, use it first if present, fall back silently if not.**
