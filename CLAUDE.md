# CLAUDE.md

## Project Overview
Beacon is a CLI tool that analyzes codebases for AI readiness using parallel LLM workers (Claude Agent SDK).

## Build & Dev Commands
- `pnpm build` — compile TypeScript to dist/
- `pnpm dev -- ./path` — run CLI in dev mode via tsx
- `pnpm typecheck` — type-check without emitting
- `pnpm lint` — run ESLint on src/
- `pnpm test` — run Vitest tests

## Architecture
```
src/
  cli/        — entry point (index.ts) and terminal rendering (render.ts)
  core/       — schemas.ts (Zod types), config.ts (constants), orchestrator.ts (pipeline)
  discovery/  — project manifest builder (discover.ts)
  synthesis/  — deterministic score aggregator (synthesize.ts)
  workers/    — BaseWorker + 8 WorkerConfigs (one per dimension)
```

## Conventions
- Use Zod schemas for all external data (see src/core/schemas.ts)
- Workers extend BaseWorker — add new dimensions in worker-configs.ts + config.ts
- Keep CLI layer thin; business logic lives in core/ and workers/
- ES modules only ("type": "module" in package.json)
- All exports are named (no default exports)
- Use `import type` for type-only imports

## Naming Conventions
- Types / Interfaces / Zod schemas: PascalCase (`WorkerConfig`, `ProjectManifest`)
- Functions and variables: camelCase (`analyzeProject`, `workerOutputs`)
- Module-level constants: UPPER_SNAKE_CASE (`ALL_DIMENSIONS`, `WORKER_CONFIGS`)
- Files: kebab-case (`base-worker.ts`, `worker-configs.ts`)

## Error Handling
- Propagate errors via thrown `Error` objects; never swallow silently
- Use `z.safeParse()` for external input and unknown JSON; throw with context on failure
- Use `z.parse()` only when you control the data and a throw is acceptable
- Document recoverable vs. fatal errors in JSDoc where non-obvious

## Test Conventions
- Co-locate `*.test.ts` files next to the source file they test
- Each public function should have at least one test case
- Use `describe` blocks per function; `it` blocks per behavior
- Prefer real data over mocks; only mock external I/O (SDK calls, filesystem)

## What NOT to Do
- Never `export default` — use named exports only
- Never `require()` — this is ES modules only; use `import`
- Never catch and ignore errors with an empty `catch` block
- Never bypass Zod for unknown/external JSON — always use `z.safeParse()`
- Never use `any` — it is a lint error; use `unknown` and narrow the type
- Never add a dependency without checking the dependency guidelines in CONTRIBUTING.md

## Adding a New Dimension
1. Add to `ALL_DIMENSIONS` and `DIMENSION_LABELS` in `src/core/config.ts`
2. Add a `WorkerConfig` to `WORKER_CONFIGS` in `src/workers/worker-configs.ts`
3. Run `pnpm build && pnpm dev ./some-project` to verify
