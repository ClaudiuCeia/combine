# combine

Typed parser combinators for complete strings and text streams in TypeScript.

The same grammar can parse a finished value or an append-only stream. Streamed
parses can return `pending` when more input could change the result.

Use combine for streamed model output, DSLs, configuration formats, protocols,
logs, and CLI output.

[![npm](https://img.shields.io/npm/v/@claudiu-ceia/combine)](https://www.npmjs.com/package/@claudiu-ceia/combine)
[![JSR](https://jsr.io/badges/@claudiu-ceia/combine)](https://jsr.io/@claudiu-ceia/combine)
[![CI](https://github.com/ClaudiuCeia/combine/actions/workflows/ci.yml/badge.svg)](https://github.com/ClaudiuCeia/combine/actions/workflows/ci.yml)

## Complete input and streamed input

```ts
import {
  createStreamingParser,
  isPending,
  parseAll,
  trie,
} from "@claudiu-ceia/combine";

const delimiter = trie(["$", "$$"]);

const finite = parseAll(delimiter, "$$");
if (finite.success) console.log(finite.value); // "$$"

const stream = createStreamingParser(delimiter);

const first = stream.feed("$");
console.log(isPending(first)); // true

const second = stream.feed("$");
if (second.success) console.log(second.value); // "$$"
```

After the first `$`, both `$` and `$$` are still possible. combine returns
`pending`. The second `$` makes the result final.

- `success` - the parser has a result for the matched prefix
- `pending` - more input or finalization is needed before deciding
- `failure` - the current input cannot match

`pending` does not guarantee that the buffered prefix can eventually succeed.
Some parsers make conservative decisions while the source remains open.
Success completes a streaming session after a prefix match, even if unread text
remains. Compose the grammar with `eof()` when trailing input must fail.

## Install

```sh
npm install @claudiu-ceia/combine
```

Alternatives:

```sh
pnpm add @claudiu-ceia/combine
bun add @claudiu-ceia/combine
```

Deno can import the package from JSR:

```ts
import { parseAll, str } from "jsr:@claudiu-ceia/combine";
```

## Why streamed text needs a pending state

```text
$
```

May become `$` or `$$`.

````text
```ts
const answer =
````

May become a complete fenced code block.

```text
<think>
```

May become a configured tagged block.

Model responses often mix prose with structured fragments. A chunk can end in
the middle of a delimiter, code fence, citation, or custom tag. Treating every
current buffer as a complete document causes incorrect failures or repeated
reinterpretation.

These inputs are unfinished, not malformed.

## Streaming API

- `createStreamingParser(parser)` creates one buffered parsing session
- `feed(chunk)` appends text and returns the current result
- `finish()` closes the input and returns a final success or failure
- `parseStream(parser, chunks)` yields states for an `AsyncIterable<string>`
- `parseStreamEach(parser, chunks, options)` yields consecutive parsed values
- `isPending(result)` distinguishes unfinished input from failure

Streaming APIs retain at most 1,048,576 UTF-16 code units by default. Pass
`{ maxBufferLength }` to choose a smaller or larger limit, or explicitly use
`{ maxBufferLength: Infinity }` for trusted unbounded input. Exceeding the limit
produces a definitive failure without appending the rejected chunk.

The same combine grammar can be used for finite and streamed input. How early a
result finalizes depends on its parsers. Streaming-aware primitives such as
`str`, `trie`, `digit`, `letter`, `space`, and `number` can resolve before the
source ends. `regex(...)` waits for final input because a JavaScript regular
expression cannot prove that a match will not grow.

Custom parsers should preserve the supplied context and account for open input.
The current engine retains buffered input up to the configured limit and
reparses it after each chunk. It does not resume from a saved parser
continuation. `finish()` converts unresolved input into a final success or
failure.

Code fences show why terminators need to remain open across chunk boundaries:

````ts
import {
  any,
  anyChar,
  createStreamingParser,
  eof,
  eol,
  isPending,
  many,
  manyTill,
  map,
  seq,
  str,
} from "@claudiu-ceia/combine";

const horizontalSpace = any(str(" "), str("\t"));
const closingFence = map(
  seq(str("```"), many(horizontalSpace), any(eol(), eof())),
  () => "```",
);
const codeLine = map(manyTill(anyChar(), eol()), (parts) => parts.join(""));
const fencedTypeScript = map(
  seq(str("```ts"), eol(), manyTill(codeLine, closingFence)),
  ([, , lines]) => lines.slice(0, -1).join(""),
);

const block = createStreamingParser(fencedTypeScript);
const prefix = block.feed("```ts\nconst answer = 42;\n``");
console.log(isPending(prefix)); // true

const complete = block.feed("`\n");
if (complete.success) console.log(complete.value);
````

The parser remains pending until a complete closing-fence line arrives. See the
[streaming guide](https://github.com/ClaudiuCeia/combine/blob/main/docs/streaming.md)
for async sources, repeated values, boundaries, retained buffers, relative
offsets, and custom parsers.

## Building a grammar

Parsers compose into typed output without a grammar file or code-generation
step.

```ts
import { map, parseAll, regex, seq, str } from "@claudiu-ceia/combine";

const predicate = map(
  seq(
    regex(/[A-Za-z][A-Za-z0-9_-]*/, "field"),
    str(":"),
    regex(/[A-Za-z0-9_-]+/, "value"),
  ),
  ([field, , value]) => ({ field, value }),
);

const result = parseAll(predicate, "status:open");

if (!result.success) throw new Error(result.expected);
console.log(result.value); // { field: "status", value: "open" }
```

The [complete query example](https://github.com/ClaudiuCeia/combine/blob/main/examples/query.ts)
adds quoted values and parentheses, uses `chainl1` for precedence and
associativity, `defineLanguage` for recursive productions, and `context` plus
`cut` for focused errors.

## Errors and backtracking

Running the complete query grammar against this malformed input:

```text
status:open AND owner:
```

Produces this output from `formatErrorReport`:

```text
expected value after ':' at line 1, column 23
1 | status:open AND owner:
  |                       ^
  in predicate at line 1, column 17
  in expression at line 1, column 17
  in query at line 1, column 1
```

`context(...)` records which grammar productions were active. `cut(...)` marks
the value after `owner:` as required, so ordered choice does not backtrack and
replace the useful error with an unrelated alternative.

## Built with combine

- [`exp`](https://github.com/ClaudiuCeia/exp) parses expressions into a typed AST
  with source spans, then evaluates them against an explicit environment
- [`ts-duckling`](https://github.com/ClaudiuCeia/ts-duckling) scans free-form
  text for dates, URLs, countries, and sensitive identifiers
- [`pii-mask`](https://github.com/ClaudiuCeia/pii-mask) uses `ts-duckling` for
  grammar-based PII detection and adds masking, structured-value traversal, and
  logger integrations

Repository examples:

- [`examples/query.ts`](https://github.com/ClaudiuCeia/combine/blob/main/examples/query.ts)
  covers typed output, precedence, recursion, and committed errors
- [`examples/calculator.ts`](https://github.com/ClaudiuCeia/combine/blob/main/examples/calculator.ts)
  builds a typed arithmetic AST with precedence and source spans
- [`examples/lisp.ts`](https://github.com/ClaudiuCeia/combine/blob/main/examples/lisp.ts)
  parses recursive lists with centralized trivia handling

## Runtime support

The npm package supports Node 20+ and is ESM-only. CommonJS callers can load it
with `await import("@claudiu-ceia/combine")`. CI validates the package with Bun
1.4 and Node, then runs the same test suite and checks every JSR entrypoint with
Deno 2.

The root entrypoint exports the complete API. Specialized entrypoints are also
available:

| Module                       | npm                                      | JSR                                          |
| ---------------------------- | ---------------------------------------- | -------------------------------------------- |
| Nondeterministic recognizers | `@claudiu-ceia/combine/nondeterministic` | `jsr:@claudiu-ceia/combine/nondeterministic` |
| Performance tracing          | `@claudiu-ceia/combine/perf`             | `jsr:@claudiu-ceia/combine/perf`             |
| Streaming                    | `@claudiu-ceia/combine/streaming`        | `jsr:@claudiu-ceia/combine/streaming`        |

## Benchmark methodology

The checked-in comparison parses equivalent recursive arithmetic grammars with
81 B, 1,795 B, and 14,384 B fixtures. CI runs three base and three candidate
passes with Bun 1.4 on the same GitHub-hosted `ubuntu-latest` runner, then
compares median p50 values. GitHub runner hardware can vary between runs.

The combine-only streaming fixture is an 8,227 B ASCII fenced block parsed as
finite input, 64 B chunks, 512 B chunks, and one complete chunk. Chunked parses
remain pending until the chunk containing the closing fence. The selected
comparison libraries do not expose the same append-only parser lifecycle, so
the suite does not make a general claim about their streaming capabilities.

```sh
bun run bench:verify
bun run bench:comparison
bun run bench:streaming
```

See the
[benchmark overview](https://github.com/ClaudiuCeia/combine/blob/main/bench/README.md)
and
[comparison methodology](https://github.com/ClaudiuCeia/combine/blob/main/bench/comparison/README.md)
for scope and limits.

## Documentation

- [Getting started and grammar design](https://github.com/ClaudiuCeia/combine/blob/main/docs/guide.md)
- [Streaming guide](https://github.com/ClaudiuCeia/combine/blob/main/docs/streaming.md)
- [API reference](https://github.com/ClaudiuCeia/combine/blob/main/docs/api.md)
- [Nondeterministic recognizers](https://github.com/ClaudiuCeia/combine/blob/main/docs/nondeterministic.md)

## Development and license

```sh
bun install
bun run check
bun run build
bun run package:check
deno task check
```

`bun run check` runs formatting, linting, TypeScript, tests, and benchmark
correctness verification and is the primary development loop. `deno task check`
reuses the test suite through a Deno-only compatibility adapter and validates
the native TypeScript entrypoints. Deno is otherwise only required to publish
the JSR package.

combine is available under the
[MIT license](https://github.com/ClaudiuCeia/combine/blob/main/LICENSE).
