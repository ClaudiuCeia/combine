# Benchmarks

Benchmarks use [Mitata](https://github.com/evanwashere/mitata). Install
dependencies and run an individual benchmark with Bun:

```bash
bun install
bun run bench/language_bench.ts
```

Run the maintained comparison with `bun run bench:comparison`.
Run the Combine-only append-stream benchmark with `bun run bench:streaming`.

CI uses Bun 1.4 on a GitHub-hosted `ubuntu-latest` runner. GitHub can assign
different hardware between workflow runs, so the pull request comparison runs
the base and candidate revisions on the same runner. It executes three runs per
revision and compares the median p50 for each Combine benchmark.

## Notes

- `language_bench.ts`: compares `defineLanguage` with raw combinators.
- `trie_vs_any_bench.ts`: compares `trie(...)` vs `any(str(...), ...)` vs
  `furthest(...)` on a synthetic keyword set (no network).
- `stress_large_list_bench.ts`: parses a large list (`[0..4999]`) using
  `createLexer` + `sepBy1`.
- `map_regex_large_bench.ts`: large generated input (>8k) exercising `map(...)`
  and `regex(...)` on a repeated clause.
- `streaming_bench.ts`: parses an 8,227 B ASCII fenced code block as finite
  input, 64 B chunks, 512 B chunks, and one complete chunk. The chunked parser
  remains pending until the chunk containing the closing fence. The timed work
  includes session construction, slicing, concatenation, and whole-buffer
  reparsing, plus result-state validation and value access. It does not measure
  `finish()`.

The streaming benchmark is Combine-only because the selected comparison
libraries do not expose the same append-only parser lifecycle. This does not
mean those packages cannot process streams through other designs.

Bench results vary based on CPU, runtime version, and flags. Do not compare
absolute results across JavaScript runtimes.
