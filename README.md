# combine

Typed parser combinators for TypeScript (Bun, Deno, and Node). Build small
parsers, then compose them into a grammar.

[![CI](https://github.com/ClaudiuCeia/combine/actions/workflows/ci.yml/badge.svg)](https://github.com/ClaudiuCeia/combine/actions/workflows/ci.yml)
[![JSR](https://jsr.io/badges/@claudiu-ceia/combine)](https://jsr.io/@claudiu-ceia/combine)
[![npm](https://img.shields.io/npm/v/@claudiu-ceia/combine)](https://www.npmjs.com/package/@claudiu-ceia/combine)

## Install

### Bun (npm)

```sh
bun add @claudiu-ceia/combine
```

```ts
import { seq, str } from "@claudiu-ceia/combine";
```

### Deno (JSR)

```ts
import { seq, str } from "jsr:@claudiu-ceia/combine@^0.11.1";
```

The same optional subpaths are available through JSR:

```ts
import { recognizeAt } from "jsr:@claudiu-ceia/combine/nondeterministic";
import { createTracer } from "jsr:@claudiu-ceia/combine/perf";
import { parseStream } from "jsr:@claudiu-ceia/combine/streaming";
```

### Node 20+ (npm)

```sh
npm i @claudiu-ceia/combine
```

Note: the npm package is **ESM-only**.

```ts
import { seq, str } from "@claudiu-ceia/combine";
```

If you're in a CommonJS project, use a dynamic import:

```js
(async () => {
  const { seq, str } = await import("@claudiu-ceia/combine");
  // Use seq and str here.
})();
```

### Optional subpaths

The root entrypoint exports the complete API. Bun, Node, and Deno can also use
smaller entrypoints for the specialized modules:

| Module                       | npm                                      | JSR                                          |
| ---------------------------- | ---------------------------------------- | -------------------------------------------- |
| Nondeterministic recognizers | `@claudiu-ceia/combine/nondeterministic` | `jsr:@claudiu-ceia/combine/nondeterministic` |
| Performance tracing          | `@claudiu-ceia/combine/perf`             | `jsr:@claudiu-ceia/combine/perf`             |
| Streaming                    | `@claudiu-ceia/combine/streaming`        | `jsr:@claudiu-ceia/combine/streaming`        |

## Quickstart

Parsers are plain functions: `(ctx) => Result<T>`. Literal parsers preserve
their literal types, `seq` infers a tuple, ordered choice infers a union, and
`map` changes the output type. Use `parseAll` when the parser must consume the
complete input, or `runParser` for prefix parsing and custom start offsets.

```ts
import {
  map,
  optional,
  parseAll,
  regex,
  seq,
  space,
  str,
  trim,
} from "@claudiu-ceia/combine";

const name = trim(regex(/[^!]+/, "name"));
const hello = map(
  seq(str("Hello,"), optional(space()), name, str("!")),
  ([, , who]) => who,
);

const result = parseAll(hello, "Hello, World!");

if (result.success) {
  console.log(result.value); // "World"
} else {
  console.error(result.expected, result.location);
}
```

## Common Building Blocks

The library exports a lot of small pieces. These are the ones you'll likely
reach for first:

- Parsers: `str`, `regex`, `digit`, `letter`, `int`, `double`, `space`, `eof`
- Composition: `seq`, `choice`/`any`, `either`, `oneOf`, `many`, `many1`,
  `optional`
- Transform: `map`, `chain`/`flatMap`, `mapJoin`, `trim`

`choice` (`any`) returns the first successful alternative. `oneOf` checks
alternatives from the same position and succeeds only when exactly one matches.
Fatal failures stop either form of choice immediately.

The [API reference](https://github.com/ClaudiuCeia/combine/blob/main/docs/api.md)
lists every parser and combinator with its output and consumption behavior.

## Streaming Input

Streaming parsers accept append-only chunks and distinguish an incomplete parse
from a definitive failure. Use `createStreamingParser` for one value,
`parseStream` for an async source, or `parseStreamEach` for consecutive values:

```ts
import { isPending, str } from "@claudiu-ceia/combine";
import { parseStreamEach } from "@claudiu-ceia/combine/streaming";

async function* chunks(): AsyncGenerator<string> {
  yield "a";
  yield "ba";
  yield "b";
}

for await (const result of parseStreamEach(str("ab"), chunks())) {
  if (result.success) console.log(result.value);
  else if (!isPending(result)) console.error(result.expected);
}
```

Success means the parser matched a prefix. It does not imply that the complete
source was consumed. Compose a value parser with `eof()` when trailing input
must fail.

The generic `regex(...)` parser waits for final input because an arbitrary
regular expression cannot reliably prove that its match will not grow. Dedicated
primitives such as `str`, `trie`, `digit`, `letter`, `space`, and `number` can
resolve incrementally. The [streaming guide](https://github.com/ClaudiuCeia/combine/blob/main/docs/streaming.md)
covers lifecycle, buffering, boundaries, repeated values, and custom parsers.

## Recursion (Grammars)

When a parser needs to reference itself (directly or indirectly), wrap the
reference with `lazy`:

```ts
import { any, lazy, map, type Parser, seq, str } from "@claudiu-ceia/combine";

type Expr = { kind: "paren"; inner: Expr } | { kind: "lit"; value: string };

const lit: Parser<Expr> = map(str("x"), (value) => ({ kind: "lit", value }));
const paren: Parser<Expr> = map(
  seq(
    str("("),
    lazy(() => expr),
    str(")"),
  ),
  ([, inner]) => ({ kind: "paren", inner }),
);

// A tiny recursive expression: x | (expr)
const expr: Parser<Expr> = any(lit, paren);
```

If you're defining a larger mutually-recursive grammar, use `defineLanguage`
with a map of production output types. It provides fully typed sibling parsers
without making declaration order significant. See the
[grammar guide](https://github.com/ClaudiuCeia/combine/blob/main/docs/guide.md).

## Better Errors

For user-facing parsers, wrap important nodes with `context(...)`, and commit to
branches with `cut(...)` (to avoid confusing backtracking). To print failures:

```ts
import { formatErrorReport, parseAll, str } from "@claudiu-ceia/combine";

const parsed = parseAll(str("ready"), "reading");
if (!parsed.success) console.error(formatErrorReport(parsed));
```

## Nondeterministic Recognizers

Most combinators are deterministic: they return a single success or failure. For
tokenizer-like use cases where you want _multiple_ simultaneous matches at the
same input position, use the nondeterministic/recognizer module:

```ts
import { many, str } from "@claudiu-ceia/combine";
import { recognizeAt, step } from "@claudiu-ceia/combine/nondeterministic";

const token = step(recognizeAt(str("="), str("==")));
const tokens = many(token);
```

`recognizeAt` keeps the outer cursor at the starting position and returns each
match with its own end context. `step` chooses an end position so the recognizer
can be used safely in repetition. See the
[recognizer guide](https://github.com/ClaudiuCeia/combine/blob/main/docs/nondeterministic.md).

## More Examples

- [Calculator](https://github.com/ClaudiuCeia/combine/blob/main/examples/calculator.ts)
  shows precedence, recursion, a lexer, spans, and an AST
- [Lisp](https://github.com/ClaudiuCeia/combine/blob/main/examples/lisp.ts)
  shows recursive lists and trivia handling
- [Tests](https://github.com/ClaudiuCeia/combine/tree/main/tests) cover edge cases
  and parser contracts

## Guides

- [API reference](https://github.com/ClaudiuCeia/combine/blob/main/docs/api.md) - runners,
  results, primitives, combinators, lexer, spans, errors, and tracing
- [Grammar guide](https://github.com/ClaudiuCeia/combine/blob/main/docs/guide.md) - offsets,
  recursion, `defineLanguage`, errors, lexer use, and tracing
- [Streaming guide](https://github.com/ClaudiuCeia/combine/blob/main/docs/streaming.md) -
  pending results, async sources, boundaries, buffering, and custom parsers
- [Recognizer guide](https://github.com/ClaudiuCeia/combine/blob/main/docs/nondeterministic.md) -
  multiple matches and explicit cursor advancement

## Benchmarks

The maintained-library comparison uses a recursive arithmetic grammar built from
advertised lexical primitives and combinators, with no user-authored regex. It
covers successful parsing, late failures, and grammar construction. Run it with:

```sh
bun run bench:verify
bun run bench:comparison
bun run bench:streaming
```

See the [benchmark methodology](https://github.com/ClaudiuCeia/combine/blob/main/bench/comparison/README.md)
for package-selection criteria and limitations. The streaming benchmark is
Combine-only because the comparison libraries do not expose equivalent
append-only parser lifecycles.

## Development

Bun owns the development toolchain:

```sh
bun install
bun run check
bun run build
bun run package:check
```

`bun run check` runs Oxfmt, Oxlint, TypeScript, the Bun test suite, and benchmark
correctness verification. Deno is required only to validate or publish the JSR
package with `deno publish --dry-run` or `deno publish`.

## License

MIT © [Claudiu Ceia](https://github.com/ClaudiuCeia)
