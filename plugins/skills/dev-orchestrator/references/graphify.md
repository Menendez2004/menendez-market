# Conditional use of graphify by Research Sub-agents

`graphify` builds a knowledge graph of a codebase (AST, imports, calls,
relations between components) so an agent can answer "what depends on X?"
or "how does A reach B?" without reading every file. When it is available,
it is the fastest way for a Research Sub-agent to map a change's blast
radius. When it is not, the Sub-agent works normally -- graphify is never a
requirement and is never installed by an agent.

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
  the CLI is available, it may run graphify only in a mode that writes
  nothing to the project (e.g. an output directory under the system temp
  dir); otherwise it reports "graphify available but no graph built" and
  the Task Agent decides whether to ask the Lead to build one.
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
