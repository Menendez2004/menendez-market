---
title: Give each QA agent only the context its scenarios need
impact: HIGH
tags:
  - qa
  - orchestration
  - context
  - briefs
  - agents
---

## Rule

Each QA agent (and qa-debugger) starts from a brief built for it alone, and
returns a short summary. Full outputs live in run files, not in the
Orchestrator's conversation, and never in a later agent's brief.

**Incorrect (spawning qa-api-adversary):**

```
The Orchestrator forks its own conversation into the agent, so it starts
with the whole test plan, every line of .env.qa (admin password, Stripe
secret, Slack secret), the full PR diff including frontend files, and the
full Linear ticket. qa-happy-path gets the same bundle.

Each agent then returns its full transcript-style output (every request
and response). The Orchestrator pastes all of it into the report and,
after triage, hands the whole collection to qa-debugger. On the re-test
iteration, the new agents also receive the previous outputs "for context".
```

qa-api-adversary needed the `## API Endpoints` section, `QA_API_URL`, the auth
variables, and the backend part of the diff. Everything else is noise that
grows with each agent and iteration, and every copied secret is one more
place it can leak from.

**Correct (same run):**

```
qa-api-adversary is a fresh agent (no fork). Its brief has: the
## API Endpoints section, the names of the .env.qa keys it needs
(QA_API_URL, QA_AUTH_METHOD, QA_AUTH_TOKEN) to read itself, the diff of
the backend files in scope, and a two-line scope summary of the ticket.

It writes its full output to .dev/qa/<run-id>/qa-api-adversary.md and
returns ~15 lines: PASS/FAIL counts, one line per scenario result, one
line per bug (severity, title, issue URL), and STOPPED_EARLY if set.

qa-debugger gets only the bugs it must fix, each with its reproduction
read from the run file. Re-test agents get only the failing scenarios.
```

**Rules:**

- Spawn agents fresh (never a fork of the Orchestrator's conversation). The
  brief is their whole context.
- A QA agent brief carries only: its test-plan section, the `.env.qa` key
  names it needs (the agent reads the values itself), the part of the PR diff
  that touches its surface (UI or API), and a short scope summary of the
  ticket. Never the full test plan, all of `.env.qa`, or the chat history.
- Agents write their full output to `.dev/qa/<run-id>/<agent>.md` and return
  a short summary. The Orchestrator reads a run file only when it needs one
  bug's details (triage, issue filing, qa-debugger brief).
- qa-debugger gets only the bugs selected for fixing, with their
  reproductions. Re-test agents get only the failing scenarios, never the
  previous outputs.
- Answers the user gives in an agent's own terminal (Forge) go into that
  agent's run file under `## User decisions`, so the Orchestrator can carry
  them into the report; a decision never lives only in one terminal.
- `.dev/` stays out of commits (in `.gitignore`, or the user confirms).

**Why it matters:**

Running agents in parallel only pays off if each one stays focused. Passing
everything to everyone rebuilds one ever-growing context, costs tokens on
every spawn and every re-test iteration, lets one agent's findings steer
another's testing, and multiplies the places where credentials end up.
