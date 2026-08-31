# Benchmarks

Benchmarks use [Mitata](https://github.com/evanwashere/mitata). Install
dependencies and run an individual benchmark with Bun:

```bash
bun install
bun run bench/language_bench.ts
```

Run the maintained comparison with `bun run bench:comparison`.

## Notes

- `language_bench.ts`: compares `defineLanguage` with raw combinators.
- `trie_vs_any_bench.ts`: compares `trie(...)` vs `any(str(...), ...)` vs
  `furthest(...)` on a synthetic keyword set (no network).
- `stress_large_list_bench.ts`: parses a large list (`[0..4999]`) using
  `createLexer` + `sepBy1`.
- `map_regex_large_bench.ts`: large generated input (>8k) exercising `map(...)`
  and `regex(...)` on a repeated clause.

Bench results vary based on CPU, runtime version, and flags. Do not compare
absolute results across JavaScript runtimes.
