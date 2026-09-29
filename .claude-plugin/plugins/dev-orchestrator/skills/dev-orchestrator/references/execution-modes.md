# Triage, planning, and execution-mode routing

## Triage criteria

Classify the submitted task as **simple** if ALL of the following hold:
- It touches a single file or a tightly-scoped single component.
- There is exactly one reasonable way to implement it (no meaningful design
  choice to make).
- It does not touch shared/production configuration, credentials, or
  infrastructure.
- It does not require deleting or overwriting existing files/configs.

Otherwise, classify it as **complex**. When in doubt, classify as complex --
the cost of an unnecessary planning pass is small; the cost of skipping
planning on something that turns out to need it is not.

## Planning (complex tasks)

For complex tasks, generate a concrete step-by-step plan before asking the
Lead how to execute it. Use the strongest available model for this pass
specifically, even if the orchestrator's own default model is weaker --
plan quality compounds across every later step, so it is the highest-value
place to spend the strongest model's reasoning.

- In Claude Code: dispatch a single, one-off Agent-tool call with
  `model: "opus"` (or the current strongest available alias), with the
  original task and any project context as its prompt, and ask it to return
  a numbered step-by-step plan. This is a planning-only dispatch: it must not
  write code or touch files, only produce the plan text.
- In harnesses without an equivalent model-override dispatch mechanism: use
  the harness's own strongest configured model for this pass, and note in
  the Context Scratchpad's `Plan` section which model actually produced it.

Each plan step should be independently describable in one or two sentences,
since that is what gets handed to a single worker in multi-agent mode (see
`SKILL.md` step 4).

## Execution-mode routing

After planning (or immediately, for simple tasks), the orchestrator always
asks the mandatory pause question (`SKILL.md` step 3) before doing any work.
Do not infer or default the answer from the task's complexity -- a complex
task's Lead might still want a single session, and a simple task's Lead
might still want it dispatched to a worker for isolation. The question is
asked every time, with no shortcut.

Routing after the Lead answers:
- **Single session** -> orchestrator executes each plan step directly, in
  order, updating the Context Scratchpad after each one.
- **Multi-agent** -> orchestrator dispatches one worker per plan step, one
  level deep, passing only that step's instructions plus the current
  scratchpad contents (see `references/context-scratchpad.md`). The
  orchestrator waits for each worker's result, updates the scratchpad, and
  only then dispatches the next step's worker -- steps are not parallelized
  across workers unless the plan explicitly marked them as independent AND
  the Lead confirmed parallel execution is acceptable when asked in step 3.
