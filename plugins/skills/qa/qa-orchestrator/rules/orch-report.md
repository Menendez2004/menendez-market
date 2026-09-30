---
title: Generate a structured QA report with verdict
impact: HIGH
tags:
  - qa
  - orchestration
  - reporting
  - verdict
---

## Rule

Every QA run must produce a report saved to `.qa/reports/YYYY-MM-DD-HHmmss-qa-report.md` with sections: Summary, Agent Results, Bugs Found table, Bug Details (if no issue tracker), Fixes Applied (if bug-fixer ran), Decisions (if the user answered anything during the run), and Verdict (PASS or FAIL).

Agent Results holds one line per scenario, not each agent's full output: that stays in `.dev/qa/<run-id>/`, which is not committed. The report is committed, so credentials are redacted (`rules/orch-no-secrets-in-output.md`).

**Incorrect (QA report):**

```
QA done. Found 2 bugs. See the agent outputs above.
```

- Error: No persistent report file, no structured summary, no verdict.
- Cause: Agent delivered results inline without saving a report artifact.

**Correct (QA report):**

```markdown
# QA Report — 2026-04-07 — PR #42: add payment processing

## Summary
- **Scope:** PR #42
- **Agents run:** qa-happy-path, qa-api-adversary
- **Result:** FAIL (2 bugs found)

## Agent Results
### qa-happy-path — 4/5 flows passed
- PASS Flow 1 — Login
- FAIL Flow 3 — Checkout redirect (bug #2)
- ...

### qa-api-adversary — 9/10 tests passed
- FAIL POST /api/orders zero quantity (bug #1)
- ...

## Bugs Found
| # | Agent | Severity | Description | Issue | Status |
|---|-------|----------|-------------|-------|--------|
| 1 | chaos-monkey | BLOCKER | POST /api/orders 500 on zero qty | LIN-456 | Fixed |
| 2 | happy-path | HIGH | Checkout redirect fails | LIN-457 | Open |

## Fixes Applied
### Fix: POST /api/orders 500 on zero quantity
**Root cause:** Missing quantity validation
**Files changed:** OrderService.java
**Risk:** LOW

## Decisions
- Triage: user chose qa-debugger for HIGH+ bugs
- qa-happy-path terminal: user confirmed the staging tenant is `acme-test`

## Verdict
**FAIL** — 1 unresolved bug remains (LIN-457)
```

- Saved to `.qa/reports/2026-04-07-143022-qa-report.md`
- Structured with all required sections and a clear verdict.

**Why it matters:**

Reports are the audit trail of QA runs. Without a saved file, results are lost when the conversation ends. The bugs table and verdict enable CI gates and team review. The structured format makes reports machine-parseable for automation.
