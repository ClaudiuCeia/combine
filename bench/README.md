# Benchmarks

Run benchmarks with:

```bash
deno bench --allow-all
```

## Notes

- `createLanguage_bench.ts`: compares `createLanguage` vs `createLanguageThis`
  vs raw combinators.
- `lisp_bench.ts`: compares a small S-expression grammar with Parsimmon.
- `trie_vs_any_bench.ts`: compares `trie(...)` vs `any(str(...), ...)` vs
  `furthest(...)` on a synthetic keyword set (no network).
- `stress_large_list_bench.ts`: parses a large list (`[0..4999]`) using
  `createLexer` + `sepBy1`.

Bench results vary a lot based on CPU, Deno version, and flags.
