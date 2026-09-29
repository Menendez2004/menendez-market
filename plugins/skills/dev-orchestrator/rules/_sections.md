# Rule Sections

## Escalation & Autonomy

Rules governing when the orchestrator or a worker agent must stop and hand a
decision to the Lead Developer, instead of proceeding on its own judgment.

## Impact levels

- **CRITICAL** -- violating this rule causes irreversible harm (data loss,
  unauthorized shared-state mutation, unrecoverable architectural drift) or
  breaks the skill's core human-in-the-loop guarantee.
- **HIGH** -- violating this rule causes significant rework or a broken
  workflow, but is recoverable.
- **MEDIUM** -- violating this rule causes friction or inconsistency.
- **LOW** -- style/convention only.

Both rules in this skill are CRITICAL: they protect the one guarantee the
skill exists to provide -- that the Lead, not the agent, makes architectural
and destructive-action calls.
