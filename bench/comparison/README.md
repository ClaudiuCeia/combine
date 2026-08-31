# Parser combinator comparison

This suite compares `combine` with maintained TypeScript/JavaScript parser
combinator packages that had at least 1,000 npm downloads in the 30-day research
window ending 2026-08-29.

## Commands

```sh
bun run bench:verify
bun run bench:comparison
bun run bench:comparison:json
```

`bench:verify` must pass before results are accepted. It checks equivalent
expression values, precedence, associativity, complete input consumption, and
rejection of malformed examples for every adapter.

`bench:comparison:json` runs the same suite but emits Mitata's machine-readable
JSON output. It does not select a JSON grammar.

Tarsec reads `process.env.DEBUG` when its tracing module is imported.

## Grammar

The suite evaluates integer expressions with parentheses, multidigit integers,
whitespace, left-associative operators, and the usual multiplication/addition
precedence. Each implementation uses advertised character, whitespace, and
integer primitives plus recursion, choice, sequencing, repetition, mapping, and
left reductions. There are no user-authored regular expressions or external
token decoders. A package's primitive may use regex internally as an
implementation detail. The corpus uses space, tab, CR, and LF, which all six
whitespace implementations recognize; individual primitives may recognize
additional whitespace outside the measured grammar.

The successful inputs are 81 B, 1,795 B, and 14,384 B. The invalid case fails
near the end of the medium input. Construction builds the grammar from scratch;
the cold-use group also parses the small input once with that new grammar.
Steady-state parsers are built outside timed callbacks.

## Fairness constraints

- Every root parser requires EOF.
- Every successful parser returns the same value.
- Grammar construction, input generation, and correctness assertions are not
  included in steady-state timings.
- Each adapter uses the package's idiomatic public primitive API. Mini-Parse
  includes creation of its required character-token stream; Peberminta includes
  conversion of the string to character tokens.
- Versions are exact in `package.json` and integrity-locked in `bun.lock`.

The suite is not a universal parser score. It covers deterministic successful
parsing, late failure detection, cold grammar construction, and construction
plus first use. It does not measure module loading, recovery, diagnostic
quality, memory, ambiguous grammars, or streaming.
