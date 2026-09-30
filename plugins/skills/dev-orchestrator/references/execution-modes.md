# Plan intake, triage, planning, and execution-mode routing

## 1. Plan intake (always first)

Most of the time the Lead Developer hands the Orchestrator the plan. Look for
one, in this order:

1. the Lead's initial request (a numbered list, checklist, "Plan:" section,
   linked/attached plan file), then
2. the `## Plan` section of `.dev/orchestrator.md`.

If either contains a plan, it is the plan. The Orchestrator **never** creates,
rewrites, reorders, splits, merges, or regenerates it -- not even to "improve"
it, and not with a stronger model. See `rules/high-adopt-lead-plan.md`.

### Validating a Lead-provided plan

Validation checks the plan is executable as written; it does not edit it.

- Every step is concrete enough to hand to one Task Agent in a brief.
- Referenced files, services, commands and branches exist (quick read-only
  check, a Research Sub-agent may help).
- Dependencies between steps are clear enough to build the dependency map
  (`references/parallelization.md`).
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

- **Propose a plan in plan mode under `opusplan`.** In Claude Code, the
  Orchestrator session runs on `opusplan`, so while in plan mode Opus drafts
  a numbered step-by-step plan. Plan mode is read-only: it writes no code and
  touches no files. If the session is not on `opusplan`, ask the Lead to
  switch (`/model opusplan`) first. In other harnesses, use the strongest
  configured model and note which one produced the plan
  (`references/models.md`).
- **Request the plan from the Lead** via `escalate_to_lead`
  (`reason: ambiguous_requirement`), e.g. when the task is too open-ended to
  plan responsibly.

An Orchestrator-proposed plan is a draft until the Lead approves it. Record
`Source: Orchestrator-proposed (opusplan), approved by Lead on <date>`.

Each plan step should be describable in one or two sentences, because that is
what one Task Agent receives.

## 4. Execution-mode routing

After intake/planning the Orchestrator always asks the mandatory question
(`SKILL.md` step 5), after showing the dependency map
(`references/parallelization.md`). Never infer the answer from the task's size.
The only exception is a request that already names the mode explicitly
("multi-agent, max 3"): then the Orchestrator shows the map, says it is
using that mode because the Lead said so, and starts without asking.

- **Single session** -> the Orchestrator executes each step in order itself,
  updating the scratchpad after each, then runs the final checks once. It
  starts each step from `.dev/research/` and may use read-only Research
  Sub-agents for anything that research does not answer
  (`references/agent-hierarchy.md`).
- **Multi-agent** -> dependency-driven: the Orchestrator launches every
  ready step (`references/parallelization.md` section 3), and for each one:
  1. writes the brief `.dev/tasks/step-[N]-[short-name].md`
     (template in `references/agent-hierarchy.md`), including the key
     findings from `.dev/research/step-[N]-[short-name].md`,
  2. starts the Task Agent on that brief: in a new terminal named
     `orch-s[N]-[short-name]` in the user's terminal app, or inline for a
     step marked `inline` (`references/terminal-launch.md`),
  3. waits in the background for the first new result among the running
     steps (`references/terminal-launch.md` section 5),
  4. merges that result into the scratchpad and launches whatever became
     ready. A `Blocked` or `Failed` step holds only its dependents.

  After the last step, the Orchestrator runs the final checks once (see
  below).

  The concurrency cap (default 4) and the map come from what the Lead saw
  at the mandatory pause; if the Lead asked for sequential, the cap is 1.

## 5. Final checks (once, at the end)

In either mode, after every plan step is complete, the Orchestrator runs the
project's fast checks once: lint, format check, typecheck, build/compile and
the project's own validators, discovered from the project's scripts or CI
config. It never runs test suites, and no check runs between steps. Results
go to the scratchpad's `## Final Checks` section.

When a check fails, the Orchestrator attributes it before reporting:

1. Extract the file paths from the failing output.
2. Match them against each step's owned files in the `## Dependency Map`.
3. Report to the Lead, in one message: each failing check, the step that
   owns each failing file (or "no owner" for files no step touched), and the
   relevant output.
4. Offer to relaunch only the owning step's Task Agent, with the same brief
   plus a `## Previous attempt` section (its result and
   `git diff --stat -- <owned files>`) and a `## Fix` section holding that
   step's errors. It runs on the same
   runner as before and fixes only those errors in its owned files.
5. Only if the Lead agrees: relaunch, wait, merge, then rerun the checks
   once and report again. Never start another round on your own.

See `rules/high-checks-not-tests.md`.
