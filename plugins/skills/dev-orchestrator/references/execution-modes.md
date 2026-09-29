# Plan intake, triage, planning, and execution-mode routing

## 1. Plan intake (always first)

Most of the time the Lead Developer hands the Orchestrator the plan. Look for
one, in this order:

1. the Lead's initial request (a numbered list, checklist, "Plan:" section,
   linked/attached plan file), then
2. the `## Plan` section of `orchestrator-scratchpad.md`.

If either contains a plan, it is the plan. The Orchestrator **never** creates,
rewrites, reorders, splits, merges, or regenerates it -- not even to "improve"
it, and not with a stronger model. See `rules/high-adopt-lead-plan.md`.

### Validating a Lead-provided plan

Validation checks the plan is executable as written; it does not edit it.

- Every step is concrete enough to hand to one Task Agent in a brief.
- Referenced files, services, commands and branches exist (quick read-only
  check, a Research Sub-agent may help).
- Dependencies between steps are clear (which steps are independent and
  could run in parallel).
- No step requires an undeclared destructive action or git mutation.

Outcomes:
- **Valid** -> record it verbatim in the scratchpad with
  `Source: Lead-provided`, then ask the mandatory pause question.
- **Gap found** -> `escalate_to_lead` with `reason: ambiguous_requirement`,
  naming the specific step and gap, with concrete options. Apply only the
  Lead's answer; log it in the `Decisions Log`.

## 2. Triage (only when no plan was provided)

Classify the task as **simple** if ALL hold:
- It touches a single file or a tightly-scoped single component.
- There is exactly one reasonable way to implement it.
- It does not touch shared/production configuration, credentials, or
  infrastructure.
- It does not require deleting or overwriting existing files/configs.

Otherwise it is **complex**. When in doubt, classify as complex.

A simple task becomes a one-step plan (`Source: Orchestrator, simple task`).

## 3. Planning (complex task AND no plan provided)

Two options -- pick the one that fits, or offer both to the Lead:

- **Propose a plan with the strongest model.** In Claude Code, a single
  one-off `Agent` call with `model: "opus"`, given the task and project
  context, asked to return a numbered step-by-step plan. Planning-only: it
  writes no code and touches no files. In harnesses without a model override,
  use the strongest configured model and note which one produced the plan.
- **Request the plan from the Lead** via `escalate_to_lead`
  (`reason: ambiguous_requirement`), e.g. when the task is too open-ended to
  plan responsibly.

An Orchestrator-proposed plan is a draft until the Lead approves it. Record
`Source: Orchestrator-proposed (opus), approved by Lead on <date>`.

Each plan step should be describable in one or two sentences, because that is
what one Task Agent receives.

## 4. Execution-mode routing

After intake/planning the Orchestrator always asks the mandatory question
(`SKILL.md` step 4). Never infer the answer from the task's size.

- **Single session** -> the Orchestrator executes each step in order itself,
  updating the scratchpad after each. It may use read-only Research
  Sub-agents (`references/agent-hierarchy.md`).
- **Multi-agent** -> for each step the Orchestrator:
  1. writes the brief `orchestrator-tasks/step-[N]-[short-name].md`
     (template in `references/agent-hierarchy.md`),
  2. opens a new terminal in the user's terminal app named
     `orch-s[N]-[short-name]` and starts an independent CLI
     session on that brief (`references/terminal-launch.md`),
  3. waits for `orchestrator-tasks/step-[N]-[short-name].result.md`,
  4. merges the result into the scratchpad, and only then launches the next
     step.

  Steps run in parallel (several Task Agent terminals at once) only if the
  plan marks them independent AND the Lead approved parallel execution when
  asked the mandatory question.
