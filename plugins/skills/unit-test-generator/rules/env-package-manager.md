---
title: Use the project's package manager; never default to npm
impact: HIGH
tags:
  - testing
  - tooling
  - package-manager
  - pnpm
  - yarn
  - bun
---

## Rule

Every command this skill runs or prints (run a test file, execute a binary,
add a dev dependency) uses the package manager the project already uses.
Detect it before running anything. **npm is never a default:** use npm only
when the project itself shows it uses npm. If nothing identifies the package
manager, ask the user instead of falling back to npm.

## Detection order (JavaScript / TypeScript)

Look in the target package's directory and walk up to the repo root (in a
monorepo the lockfile and `packageManager` field live at the workspace root).
Stop at the first signal found:

| # | Signal | Package manager |
|---|---|---|
| 1 | `"packageManager"` in `package.json` (e.g. `"pnpm@9.12.0"`, `"yarn@4.5.0"`) | The one it names, at that version |
| 2 | `pnpm-lock.yaml` or `pnpm-workspace.yaml` | pnpm |
| 3 | `yarn.lock` (`.yarnrc.yml` means Yarn Berry; otherwise Yarn Classic) | yarn |
| 4 | `bun.lock` or `bun.lockb` | bun |
| 5 | `package-lock.json` or `npm-shrinkwrap.json` | npm (the project chose it) |
| 6 | Commands in CI config, `CONTRIBUTING.md`, README or `package.json` scripts (`pnpm install`, `yarn build`…) | The one they use |
| — | Several lockfiles that disagree | Ask the user which one is current |
| — | No signal at all | Ask the user; suggest pnpm. Do **not** use npm |

## Commands

| Action | pnpm | yarn | bun | npm (only when detected) |
|---|---|---|---|---|
| Run the repo's test script on one file | `pnpm test <file>` | `yarn test <file>` | `bun run test <file>` | `npm test -- <file>` |
| Execute a local binary | `pnpm exec vitest run <file>` | `yarn vitest run <file>` | `bunx vitest run <file>` | `npx vitest run <file>` |
| Add a dev dependency (after approval) | `pnpm add -D <pkg>` | `yarn add -D <pkg>` | `bun add -d <pkg>` | `npm install -D <pkg>` |
| Add to one workspace package | `pnpm --filter <name> add -D <pkg>` | `yarn workspace <name> add -D <pkg>` | `bun add -d <pkg>` (run inside the package) | `npm install -D <pkg> -w <name>` |

Notes:

- With bun, `bun test` is Bun's own test runner, not the `test` script. Use
  `bun run test` when the project runs Vitest or Jest through a script, and
  `bun test` only when the project uses Bun's runner.
- Prefer the project's script (`pnpm test <file>`) over calling the binary
  directly when the script adds required setup (env files, config flags).
- Never run `npx`, `npm install` or `npm exec` in a project that uses
  another package manager: it creates a `package-lock.json`, ignores the
  real lockfile and can install different versions.
- Never commit or leave behind a lockfile the project did not already have.
- Yarn Classic (1.x) does not install peer dependencies. When adding a
  test tool with it, also add its required peers (for example `vite` for
  `vitest`), after the same approval.

## Other ecosystems

The same principle applies outside JavaScript: use what the project uses.

| Signal | Use |
|---|---|
| `uv.lock` | `uv run pytest <file>`, `uv add --dev <pkg>` |
| `poetry.lock` | `poetry run pytest <file>`, `poetry add --group dev <pkg>` |
| `pdm.lock` | `pdm run pytest <file>`, `pdm add -dG test <pkg>` |
| `Pipfile.lock` | `pipenv run pytest <file>`, `pipenv install --dev <pkg>` |
| Only `requirements*.txt` | the project's virtualenv; add to the dev requirements file the repo uses |
| Gradle wrapper / Maven wrapper | `./gradlew`, `./mvnw` over a global `gradle` / `mvn` |

**Incorrect (repo has `pnpm-lock.yaml`):**

```
npx vitest run test/order-service.test.ts
npm install -D @faker-js/faker
```

- Error: Uses npm in a pnpm project; the install writes a
  `package-lock.json` and resolves versions outside the real lockfile.

**Correct:**

```
pnpm exec vitest run test/order-service.test.ts
pnpm add -D @faker-js/faker        # only after the user approves the dependency
```

**Correct (no lockfile, no `packageManager`, nothing in docs or CI):**

```
I could not tell which package manager this project uses (no lockfile or
packageManager field). Which one should I use — pnpm, yarn or bun?
```

**Why it matters:** Each package manager has its own lockfile and resolution.
Running a different one changes installed versions, adds a stray lockfile to
the diff, and can make tests pass locally but fail in CI.
