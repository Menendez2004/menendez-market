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
   the next plan step, do not dispatch another worker -- until the Lead
   replies in plain text.
4. Resume only once the Lead's reply resolves the `reason` this escalation
   was raised for.

### Claude Code fast path

On Claude Code specifically, prefer presenting the same halt-and-wait
contract through the native `AskUserQuestion` tool instead of raw JSON in
chat, when the escalation has enumerable `options` -- it gives the Lead a
structured choice UI instead of free text. The JSON block is still the
canonical, portable form; `AskUserQuestion` is a presentation-layer
optimization for one harness, not a replacement for the protocol.

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
