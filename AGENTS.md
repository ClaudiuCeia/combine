# Repository Guidelines

## Project Structure

- `mod.ts`: Public entrypoint (re-exports the library surface).
- `src/`: Library implementation (TypeScript). Core modules include `Parser.ts`,
  `combinators.ts`, and `parsers.ts`.
- `tests/`: Bun tests (`*.test.ts`) using `bun:test`.
- `examples/`: Small runnable examples.
- `bench/`: Benchmarks (excluded from publishing).
- `dist/`: Generated npm publish artifact (do not edit by hand; do not commit
  changes).

## Build, Test, and Development Commands

Run these from the repo root:

- `bun run check`: Checks formatting, lint, types, tests, and benchmark adapters.
- `bun test`: Run the test suite.
- `bun run format`: Format code and Markdown with Oxfmt.
- `bun run lint`: Run Oxlint.
- `bun run typecheck`: Type-check source, tests, benchmarks, and scripts.
- `bun run build`: Generates the Node 20+ ESM package into `dist/`.
- `bun run package:check`: Validates the npm package with publint and attw.
- `deno task check`: Type-checks examples and runs the test suite with Deno.
- `deno task test`: Runs the shared test suite with Deno.

Install the local pre-commit hook with `bun run hooks:install`; it runs
`bun run check`.

## Coding Style & Naming Conventions

- Use Oxfmt (`bun run format`) as the source of truth for formatting.
- Prefer explicit types for exported functions/types.
- File naming follows existing patterns: core types in `PascalCase.ts` (ex:
  `Parser.ts`), utilities in `camelCase.ts` (ex: `combinators.ts`).
- Keep runtime code dependency-free and compatible with Bun, Deno, and Node 20+.

## Testing Guidelines

- Tests live in `tests/` and should be named `*.test.ts`.
- Use `bun:test` and deterministic inputs (no network/time dependencies).
- `deno.test.json` remaps `bun:test` to the Deno test adapter so the same suite
  runs under both runtimes without changing the Bun-first test imports.

## Commit & Pull Request Guidelines

- Commit messages generally follow Conventional Commits: `feat(...)`,
  `fix(...)`, `chore:`, `docs:`.
- PRs should include: what changed, why, and how to validate (commands run).
  Link an issue if applicable.

## Release / Publishing

- `package.json` is the version source of truth; `deno.json` mirrors it for JSR.
- Tag releases as `vX.Y.Z` (example: `v0.2.4`). The GitHub workflow publishes to
  JSR, then builds and publishes the root package to npm using trusted publishing.
