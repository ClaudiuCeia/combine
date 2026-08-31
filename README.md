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
import { seq, str } from "jsr:@claudiu-ceia/combine@^0.8.0";
```

Subpath imports are also supported:

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

## Quickstart

Parsers are plain functions: `(ctx) => Result<T>`. Use `parseAll` when the
parser must consume the complete input, or `runParser` for partial parsing and
custom start offsets.

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

The library exports a lot of small pieces; these are the ones you'll likely
reach for first:

- Parsers: `str`, `regex`, `digit`, `letter`, `int`, `double`, `space`, `eof`
- Composition: `seq`, `choice`/`any`, `either`, `oneOf`, `many`, `many1`,
  `optional`
- Transform: `map`, `chain`/`flatMap`, `mapJoin`, `trim`

`choice` (`any`) returns the first successful alternative. `oneOf` evaluates all
alternatives and succeeds only when exactly one matches.

If you like learning by examples, start with `tests/`.

## Streaming Input

Streaming parsers accept append-only chunks and distinguish an incomplete parse
from a definitive failure. Use `createStreamingParser` for one value,
`parseStream` for an async source, or `parseStreamEach` for consecutive values:

```ts
import { isPending, parseStreamEach, str } from "@claudiu-ceia/combine";

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

The generic `regex(...)` parser waits for final input because an arbitrary
regular expression cannot reliably prove that its match will not grow. Dedicated
primitives such as `str`, `trie`, `digit`, `letter`, `space`, and `number` can
resolve incrementally. See `docs/guide.md` for lifecycle and boundary details.

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
without making declaration order significant. See `docs/guide.md`.

## Better Errors

For user-facing parsers, wrap important nodes with `context(...)`, and commit to
branches with `cut(...)` (to avoid confusing backtracking). To print failures:

```ts
import { formatErrorStack } from "@claudiu-ceia/combine";

if (!result.success) console.error(formatErrorStack(result));
```

## Nondeterministic Recognizers

Most combinators are deterministic: they return a single success or failure. For
tokenizer-like use cases where you want _multiple_ simultaneous matches at the
same input position, use the nondeterministic/recognizer module:

```ts
import { recognizeAt } from "@claudiu-ceia/combine/nondeterministic";
```

These combinators can return multiple successes; you must decide how (or
whether) to advance the cursor.

## More Examples

- `tests/` has the most coverage and real usage patterns
- `examples/` contains small runnable snippets

## Guides

If you want the deeper explanations (recursion patterns, `defineLanguage`, error
handling, streaming, `cut` vs `context`, and `any` vs `furthest`), see
`docs/guide.md`.

The guide also covers the optional lexer layer (`lexeme`, `symbol`, `keyword`,
`createLexer`) for trivia/comments, plus the library's UTF-16 offset policy.

## Benchmarks

The maintained-library comparison uses a recursive arithmetic grammar built from
advertised lexical primitives and combinators, with no user-authored regex. It
covers successful parsing, late failures, and grammar construction. Run it with:

```sh
bun run bench:verify
bun run bench:comparison
```

See `bench/comparison/README.md` for methodology, package-selection criteria,
and limitations.

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
