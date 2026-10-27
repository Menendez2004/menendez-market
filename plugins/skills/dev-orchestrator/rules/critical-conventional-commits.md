---
title: Every commit message follows Conventional Commits 1.0.0
impact: CRITICAL
tags: [git, commits, conventional-commits, formatting]
---

All commit messages generated must strictly follow the
**Conventional Commits 1.0.0** specification. This is obligatory.

## Structure

```text
<type>[optional scope]: <description>

[optional body]
```

## Formatting standards

### 1. Header line

- **Type**: lowercase, one of:
  - `feat`: a new feature for the user (MINOR in SemVer)
  - `fix`: a bug fix for the user (PATCH in SemVer)
  - `style`: changes that do not affect the meaning of the code
    (white-space, formatting, missing semi-colons, etc.)
  - `refactor`: a code change that neither fixes a bug nor adds a feature
  - `perf`: a code change that improves performance
  - `test`: adding missing tests or correcting existing tests
  - `build`: changes to the build system or external dependencies
    (e.g. npm, vite, cargo)
  - `chore`: other changes that don't modify src or test files
- **Scope** (optional): a noun naming a section of the codebase, in
  parentheses, e.g. `feat(parser): ...`.
- **Description**: concise summary in imperative, present tense ("add",
  not "added" or "adds").
  - Do not capitalize the first letter.
  - Do not end with a period (`.`).
  - The whole header line is at most **72 characters**.
- **Breaking change**: add `!` before the colon, e.g. `feat(api)!: ...`,
  and explain it in the body with a `BREAKING CHANGE:` paragraph.

### 2. Body (optional)

- Separated from the header by exactly **one blank line**.
- Imperative, present tense.
- Explains the **motivation** for the change and **what** changed versus
  the previous behavior, not how it was implemented.
- Wrapped at **30 characters** per line.

No trailers of any kind (`Co-Authored-By:` and similar):
`rules/critical-git-commits.md`.

## Examples

**Incorrect:**

```text
Added OAuth2 login.
```

```text
Feat(Auth): Adds support for OAuth2 login.

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Correct -- simple feature:**

```text
feat(auth): add support for OAuth2 login
```

**Correct -- bug fix with body:**

```text
fix(compiler): prevent infinite loop in parser

Fix an issue where circular
dependencies in module
imports caused the AST
generator to freeze
indefinitely.
```

**Correct -- breaking change:**

```text
feat(api)!: drop support for v1 endpoints

BREAKING CHANGE: The v1 REST
API endpoints have been
removed. Migrate to the v2
endpoints documented at
/docs/v2.
```

**Why it matters:** A uniform, machine-readable history lets changelogs
and SemVer bumps be derived from commits, and lets reviewers tell at a
glance what kind of change each commit is.
