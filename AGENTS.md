# Repository Guidelines

## Project Structure

- `mod.ts`: Public entrypoint (re-exports the library surface).
- `src/`: Library implementation (TypeScript). Core modules include `Parser.ts`,
  `combinators.ts`, and `parsers.ts`.
- `tests/`: Deno tests (`*.test.ts`) using `Deno.test` and `@std/assert`.
- `examples/`: Small runnable examples.
- `bench/`: Benchmarks (excluded from publishing).
- `scripts/`: Repo tooling (notably npm build tooling).
- `npm/`: Generated npm publish artifact (do not edit by hand; do not commit
  changes).

## Build, Test, and Development Commands

Run these from the repo root:

- `deno task check`: Formats, lints, and runs tests
  (`deno fmt && deno lint && deno test --ignore=npm`).
- `deno test`: Run the test suite.
- `deno fmt`: Auto-format code and Markdown.
- `deno lint`: Static analysis for TS/JS.
- `deno task build:npm`: Generates the npm package into `npm/` using
  `@deno/dnt`.

Tip: install the local git hook with `deno task hooks:install` (runs the same
checks on commit).

## Coding Style & Naming Conventions

- Use `deno fmt` as the source of truth for formatting.
- Prefer explicit types for exported functions/types.
- File naming follows existing patterns: core types in `PascalCase.ts` (ex:
  `Parser.ts`), utilities in `camelCase.ts` (ex: `combinators.ts`).
- Keep runtime code dependency-free and Node-compatible (tests may use
  Deno/JSR-only deps).

## Testing Guidelines

- Tests live in `tests/` and should be named `*.test.ts`.
- Use `@std/assert` assertions and deterministic inputs (no network/time
  dependencies).

## Commit & Pull Request Guidelines

- Commit messages generally follow Conventional Commits: `feat(...)`,
  `fix(...)`, `chore:`, `docs:`.
- PRs should include: what changed, why, and how to validate (commands run).
  Link an issue if applicable.

## Release / Publishing

- `deno.json` is the version source of truth.
- Tag releases as `vX.Y.Z` (example: `v0.2.4`). The GitHub workflow publishes to
  JSR, then builds and publishes `./npm` to npm (requires `NPM_TOKEN` secret).
