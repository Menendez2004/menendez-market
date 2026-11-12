---
title: Every finding has evidence; the verdict follows fixed criteria
impact: CRITICAL
tags:
  - reporting
  - evidence
  - verdict
---

## Rule

### Evidence
Each finding states: ID and severity, `file:line` (on the merged tree or
the side it comes from), what happens, the proof (check output, the
target commit that causes it, the call site you read), and the smallest
fix. What you suspect but cannot prove goes under **Open questions**.

### Severity
- **BLOCKER** — regression in a check, unresolved textual conflict,
  confirmed semantic conflict, a consumer confirmed broken, a migration
  that fails or loses data, a secret committed.
- **HIGH** — likely breakage you could not confirm (an unverified
  consumer with an incompatible call site), an incompatible contract
  change for external clients, a missing required config in some env.
- **MEDIUM / LOW** — risk or cleanliness issues, minimalism (ponytail)
  findings, missing tests for touched flows.

### Verdict
- **⛔ Not ready** — at least one BLOCKER.
- **⚠️ Ready with conditions** — no BLOCKER, but at least one HIGH, or
  key checks/flows could not be verified. List each condition.
- **✅ Ready** — merge is clean, merged checks have no regressions, every
  affected flow is verified by a check or by reading, no HIGH findings.

Never soften the verdict because the change is small or urgent, and
never block it on style or on ponytail findings alone.

**Incorrect:**

```markdown
Verdict: looks good overall, a few things to keep an eye on.
```

**Correct:**

```markdown
Verdict: ⛔ Not ready — 1 blocker.
B1 [BLOCKER] Merged typecheck fails: `coupons/apply.ts:22` calls `calcTotal`, renamed to
`computeTotal` on main in a1b2c3d. Fix: rebase/merge main into the branch and update both call sites.
```

**Why it matters:** The verdict is what gets acted on. If its criteria
move with the reviewer's mood, nobody can trust a "Ready".
