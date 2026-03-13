# Contributing to Beacon

## Dev Setup

```bash
pnpm install
pnpm build        # compile TypeScript
pnpm dev -- .     # run against current directory
```

## Commands

| Command | Description |
|---|---|
| `pnpm build` | Compile TypeScript to dist/ |
| `pnpm dev -- ./path` | Run CLI in dev mode |
| `pnpm typecheck` | Type-check without emitting |
| `pnpm lint` | Run ESLint on src/ |
| `pnpm test` | Run Vitest tests |

## Adding a New Dimension

1. Add the dimension name to `ALL_DIMENSIONS` and `DIMENSION_LABELS` in `src/core/config.ts`
2. Add a `WorkerConfig` to `WORKER_CONFIGS` in `src/workers/worker-configs.ts`
3. Add a test case in `src/synthesis/synthesize.test.ts`
4. Run `pnpm build && pnpm dev ./some-project` to verify output

## PR Conventions

- Keep PRs focused — one feature or fix per PR
- Run `pnpm typecheck && pnpm lint && pnpm test` before opening a PR
- CI must pass before merging

## Dependencies

- Production deps go in `dependencies`, dev-only tools in `devDependencies`
- Prefer packages already in the dependency tree before adding new ones
- All packages must support ES modules
