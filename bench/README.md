# Benchmarks

Run benchmarks with:

```bash
deno bench --allow-all
```

## Results

### createLanguage overhead

Measures the overhead of `createLanguage` vs raw combinators.

```
benchmark                time/iter (avg)        iter/s      (min … max)           p75      p99     p995
------------------------ ------------------- ----------- --------------------- --------- --------- ---------
createLanguage_bench.ts
createLanguage              223.2 µs         4,481.0   (178.5 µs …   1.0 ms)   217.7 µs   466.9 µs   646.9 µs
raw                         177.6 µs         5,629.0   (146.1 µs … 775.1 µs)   171.8 µs   330.4 µs   464.9 µs

summary
  createLanguage
     1.26x slower than raw
```

### Lisp parsing (vs Parsimmon)

Compares combine vs parsimmon on a Lisp S-expression parser.

```
benchmark         time/iter (avg)        iter/s      (min … max)           p75      p99     p995
----------------- ------------------- ----------- --------------------- --------- --------- ---------
lisp_bench.ts
combine               60.5 µs        16,540.0    (51.1 µs … 298.9 µs)    58.9 µs   106.9 µs   140.2 µs
parsimmon              1.7 ms           606.1     (1.4 ms …   3.9 ms)     1.6 ms     2.7 ms     3.0 ms

summary
  combine
    27.30x faster than parsimmon
```

### Trie vs any vs furthest

Compares different strategies for matching one of many string literals.

```
benchmark              time/iter (avg)        iter/s      (min … max)           p75      p99     p995
---------------------- ------------------- ----------- --------------------- --------- --------- ---------
trie_vs_any_bench.ts
any                         8.9 µs       112,540.0     (7.1 µs … 256.7 µs)     8.6 µs    15.3 µs    23.9 µs
furthest                   30.5 µs        32,830.0    (24.2 µs … 351.9 µs)    29.2 µs    62.7 µs    86.5 µs
trie                      197.0 µs         5,076.0   (160.7 µs … 598.9 µs)   193.9 µs   364.7 µs   450.7 µs

summary
  any
     3.43x faster than furthest
    22.17x faster than trie
```
