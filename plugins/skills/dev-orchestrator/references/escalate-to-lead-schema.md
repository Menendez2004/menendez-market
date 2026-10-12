# `escalate_to_lead` protocol

## Why this is a protocol, not a registered tool

`escalate_to_lead` cannot be a real registered tool/function call, because
this skill is plain markdown (Agent Skills spec) and must work identically
across Claude Code, Cursor, OpenCode, and Codex -- harnesses that do not
share a tool-calling surface. Instead, it is a **strict stop-and-wait
convention** every implementation of this skill must follow, regardless of
harness.

## Protocol

1. Emit a fenced JSON block matching the schema below.
2. Immediately follow it with a short, plain-language restatement of the
   `context` and `options` fields, so a human skimming the transcript
   doesn't need to parse JSON to understand what's being asked.
3. Stop. Do not take any further action -- do not implement, do not move to
   the next plan step, do not launch another Task Agent -- until the Lead
   replies in plain text.
4. Resume only once the Lead's reply resolves the `reason` this escalation
   was raised for.

### Who escalates, and where

The Lead answers questions in **one place: the main session**, and only
the Orchestrator asks them there. A question written into a document (a
plan, the scratchpad, a brief, a result) is not an escalation: the Lead
does not read those files to find decisions waiting on them. Every other
session relays its question to the Orchestrator, which asks it directly.

- **Orchestrator (Level 0)**: asks in the Lead's main session, directly
  (on Claude Code, `AskUserQuestion`; see below).
- **Planner Agent (Level 1)**: returns its open questions in its reply.
  The Orchestrator asks them before saving or showing the plan, and only
  the answers go into the plan file.
- **Task Agent (Level 1, terminal or inline)**: never asks in its own
  session. It writes `Status: Blocked` plus the JSON payload to its result
  file and stops (a terminal session then closes by itself). The
  Orchestrator asks the Lead in the main session, logs the answer in
  `.dev/tasks/_decisions.md`, and relaunches the step with the answer in
  its `## Previous attempt` section.
- **Research Sub-agent (Level 2)**: never escalates. It reports the open
  question in its synthesis; the Task Agent relays it as above if it
  needs the Lead.

### Claude Code: always `AskUserQuestion`

On Claude Code, the Orchestrator presents every escalation with
enumerable `options` through the native `AskUserQuestion` tool, so the
Lead picks from a structured choice in the terminal instead of reading a
list of questions in chat or in a file. Put the recommended option first
with "(Recommended)" in its label, keep labels short, and put the
trade-off in each option's description. Only an escalation with no
concrete options (a value to type in) goes as plain text. The JSON block
remains the canonical, portable form for result files and for harnesses
without `AskUserQuestion`.

### Batching

When several escalations are pending for the Orchestrator at the same time
(plan gaps found in validation, several inline steps `Blocked`, failed
checks), raise them together in **one** message instead of one per turn:
one JSON block per escalation, each prefixed with the step it concerns,
then a single plain-language summary that numbers the questions. With
`AskUserQuestion`, put them in one call (up to its question limit; split
the rest into the next call). Each escalation still halts only what it
blocks: steps that do not depend on any of them keep running.

Escalations relayed by Task Agents (terminal or inline) are batched with
the rest, since they all reach the Lead through the Orchestrator.

## Schema

```json
{
  "name": "escalate_to_lead",
  "description": "Halt execution and hand a decision to the human Lead Developer. MUST be used for: missing/ambiguous requirements, architectural crossroads, or any destructive action (delete, overwrite, git commit/push/merge/PR).",
  "parameters": {
    "type": "object",
    "properties": {
      "reason": {
        "type": "string",
        "enum": ["ambiguous_requirement", "architectural_decision", "destructive_action"]
      },
      "context": {
        "type": "string",
        "description": "What triggered the escalation, in the current step's terms"
      },
      "options": {
        "type": "array",
        "items": { "type": "string" },
        "minItems": 1,
        "description": "Concrete choices the Lead can pick from, if any exist"
      },
      "blocking": { "type": "boolean", "const": true }
    },
    "required": ["reason", "context", "blocking"]
  }
}
```

## Field notes

- `reason` is always one of the three enum values -- if none seems to fit,
  it's `architectural_decision` (the catch-all for "more than one reasonable
  path forward").
- `options` is omitted only when there genuinely are no concrete choices yet
  (e.g. "I need a value, not a choice between values") -- prefer always
  supplying at least one concrete option plus an implicit "something else"
  when in doubt, since it's faster for the Lead to react to than to compose
  a free-form answer.
- `blocking` is always `true`. There is no non-blocking form of this
  protocol in this skill -- if it doesn't need to block, it isn't an
  escalation, it's just a status update in the Context Scratchpad.

## Example transcript

```
escalate_to_lead({
  "reason": "architectural_decision",
  "context": "Step 4 needs a caching layer in front of the read path. Two
              reasonable options given the existing stack.",
  "options": ["In-process LRU cache (simple, resets on deploy)",
              "Redis-backed cache (survives deploys, adds an infra dependency)"],
  "blocking": true
})

Step 4 needs a caching layer. I see two reasonable options: an in-process LRU
cache (simple, resets on every deploy) or a Redis-backed cache (survives
deploys, but adds an infrastructure dependency). Which do you want?
```
