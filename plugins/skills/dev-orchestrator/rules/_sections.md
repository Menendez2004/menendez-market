# Rule Sections

## Escalation & Autonomy

Rules governing when the Orchestrator or a Task Agent must stop and hand a
decision to the Lead Developer, instead of proceeding on its own judgment.

- `critical-ask-the-lead.md`
- `critical-no-autonomous-git.md`
- `high-adopt-lead-plan.md`

## Verification

Rules governing how finished work is verified.

- `high-checks-not-tests.md`

## Agent Hierarchy

Rules governing the two-level agent model: who may spawn whom, and what each
level may touch.

- `critical-max-two-levels.md`
- `critical-research-read-only.md`
- `high-parallel-disjoint-writes.md`
- `high-scoped-context.md`

## Impact levels

- **CRITICAL** -- violating this rule causes irreversible harm (data loss,
  unauthorized shared-state mutation, unrecoverable architectural drift) or
  breaks the skill's core human-in-the-loop guarantee.
- **HIGH** -- violating this rule causes significant rework or a broken
  workflow, but is recoverable.
- **MEDIUM** -- violating this rule causes friction or inconsistency.
- **LOW** -- style/convention only.

The CRITICAL rules protect the guarantees the skill exists to provide: the
Lead, not an agent, makes architectural and destructive-action calls, and
the agent tree never grows beyond what the Lead can see and control.
