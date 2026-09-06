# Streaming guide

combine streams append-only `string` chunks through the same `Parser<T>` values
used for finite input. A parser can succeed, fail definitively, or remain pending
while an open boundary can still change the result.

- [Result states](#result-states)
- [One buffered value](#one-buffered-value)
- [Delimiter boundaries](#delimiter-boundaries)
- [Async sources](#async-sources)
- [Repeated values](#repeated-values)
- [Boundaries](#boundaries)
- [Fenced blocks](#fenced-blocks)
- [Buffering and backpressure](#buffering-and-backpressure)
- [Custom parsers](#custom-parsers)
- [Lexer behavior](#lexer-behavior)
- [Text decoding and offsets](#text-decoding-and-offsets)

The APIs are available from the root entrypoint and from the streaming subpath:

```ts
import { eof, isPending, seq, str } from "@claudiu-ceia/combine";
import {
  createStreamingParser,
  parseStream,
  parseStreamEach,
} from "@claudiu-ceia/combine/streaming";
```

## Result states

A streaming parser result has three states:

- `result.success === true` is a successful decision
- `isPending(result)` is provisional and needs more input or finalization
- any other failed result is definitive

Pending results carry `expected`, `location`, `variants`, and `stack` fields for
progress diagnostics, but they are not errors yet and are always nonfatal. Test
`isPending(result)` before formatting or reporting a failed result.

`finish()` and normal async-source exhaustion turn any invalid final pending
result from a custom parser into an ordinary failure.

## One buffered value

`createStreamingParser(parser)` returns a single-use `StreamingParser<T>`:

```ts
type StreamingParser<T> = Readonly<{
  feed: (chunk: string) => Result<T>;
  finish: () => Result<T>;
  readonly done: boolean;
}>;
```

Each `feed(chunk)` appends the chunk and runs the grammar with
`Context.final === false`. While the result is pending, another chunk can be
fed. A success or definitive failure marks the session as done, and a later
`feed()` throws.

While a session is pending, `finish()` reruns the grammar with
`Context.final === true`. If an earlier `feed()` already completed the session,
`finish()` returns that exact cached result without rerunning it. Repeated calls
to `finish()` return the same terminal result.

```ts
import { createStreamingParser } from "@claudiu-ceia/combine/streaming";
import { isPending, str } from "@claudiu-ceia/combine";

const stream = createStreamingParser(str("Content-Type:"));

isPending(stream.feed("Content-")); // true
const result = stream.feed("Type:");
// result.success === true
// stream.done === true
```

## Delimiter boundaries

`trie` waits when the current input is both a complete match and a prefix of a
longer configured match:

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

The first `$` is valid but not final because `$$` can still win. A second `$`
closes the choice. Calling `finish()` after the first chunk instead closes the
source and returns `$`.

### Prefix success and complete input

Success means the parser matched a prefix. It does not imply that all buffered
input was consumed:

```ts
const prefix = createStreamingParser(str("OK"));
const result = prefix.feed("OKgarbage");
// success at result.ctx.index === 2; "garbage" remains unread
```

Compose with `eof()` when trailing input must fail. In streaming mode `eof()`
also keeps an otherwise complete value pending until the source is finalized:

```ts
import { eof, seq, str } from "@claudiu-ceia/combine";
import { createStreamingParser } from "@claudiu-ceia/combine/streaming";

const complete = createStreamingParser(seq(str("OK"), eof()));
complete.feed("OK"); // pending because the source is still open
complete.finish(); // success

const invalid = createStreamingParser(seq(str("OK"), eof()));
invalid.feed("OK!"); // definitive failure because input remains
```

## Async sources

`parseStream(parser, chunks)` wraps the buffered session in an
`AsyncGenerator<Result<T>>`. It yields parser state updates, not only the final
result.

```ts
import { isPending, str } from "@claudiu-ceia/combine";
import { parseStream } from "@claudiu-ceia/combine/streaming";

async function* chunks(): AsyncGenerator<string> {
  yield "hel";
  yield "lo";
}

for await (const result of parseStream(str("hello"), chunks())) {
  if (result.success) console.log(result.value);
  else if (!isPending(result)) console.error(result.expected);
}
```

The helper follows this lifecycle:

1. It probes the parser against empty open input before pulling the source.
2. A terminal result from that probe is yielded immediately. Its initial pending
   result is not yielded.
3. Empty chunks are skipped. Each nonempty chunk produces one yielded result.
4. The helper stops pulling as soon as the parser succeeds or definitively
   fails.
5. Normal source exhaustion finalizes a pending parser and yields one final,
   non-pending result.

Source exceptions propagate. If a consumer cancels or breaks early, the helper
does not synthesize a final result.

## Repeated values

`parseStreamEach(parser, chunks, options?)` parses consecutive values from one
source. A success is one completed value, not the end of the generator.

```ts
import { isPending, str } from "@claudiu-ceia/combine";
import { parseStreamEach } from "@claudiu-ceia/combine/streaming";

async function* chunks(): AsyncGenerator<string> {
  yield "a";
  yield "ba";
  yield "b";
}

for await (const result of parseStreamEach(str("ab"), chunks())) {
  if (result.success)
    console.log(result.value); // "ab", then "ab"
  else if (!isPending(result)) console.error(result.expected);
}
```

The repeated parser must advance on every success. A zero-width success becomes
a descriptive failure instead of an infinite loop. Any definitive parser
failure is yielded and ends iteration. The helper does not skip malformed input
or recover automatically.

Completed prefixes are discarded between source-chunk batches. The current
incomplete value stays buffered. Result contexts and spans are therefore
relative to the retained buffer window, not absolute stream offsets. Values in
later batches may start at index zero again.

### Required termination with `until`

`options.until` defaults to `eof()`. A custom `until` parser is checked at each
value boundary before the value parser:

```ts
declare const chunks: AsyncIterable<string>;

for await (const result of parseStreamEach(str("ab"), chunks, {
  until: str("END"),
})) {
  // "ababEND" yields two values, then stops without yielding END.
}
```

- success ends iteration cleanly and the terminator value is discarded
- pending takes precedence over the value parser, so a split terminator can be
  recognized safely
- fatal failure is yielded and stops iteration
- ordinary failure lets the value parser run
- final source exhaustion without a successful custom terminator yields the
  terminator failure

A custom `until` is a required whole-stream stopping marker, not a record
separator. The default `eof()` ends iteration normally when the source is
exhausted. A successful custom terminator can leave later text in the same
buffered chunk inaccessible because the helper stops there. Do not put unrelated
data after it unless discarding that data is intentional.

## Boundaries

Open input makes some decisions provisional:

| Parser or combinator                        | Open-boundary behavior                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `str`, `anyChar`, `digit`, `letter`, `take` | Succeed as soon as enough input exists. They do not require a delimiter.                                         |
| `trie`                                      | Waits while the current match can extend to a longer candidate. Otherwise it commits the longest complete match. |
| `space`, `int`, `double`, `number`          | Stay pending while the token reaches the open end. A nonmatching delimiter or `finish()` closes it.              |
| `regex`                                     | Always stays pending while `final === false`, even if a delimiter is already buffered.                           |
| `takeText`                                  | Waits for finalization.                                                                                          |
| `eof`                                       | Stays pending at the open end and definitively fails when unread input exists.                                   |
| `optional`                                  | Does not turn pending into absence.                                                                              |
| `many`, `sepBy`, `chainl1`, `chainr1`       | Stay pending when another value, separator, or operator may be split across the boundary.                        |
| `manyTill`                                  | Tests the terminator first. A partial terminator blocks content parsing.                                         |
| `peek`, `not`, `minus`                      | Propagate pending lookahead instead of deciding early.                                                           |
| `cut`                                       | Leaves pending nonfatal. It commits only a definitive failure.                                                   |

Ordered choice also matters. `any` and `choice` stop at the first pending
alternative because that branch may still win. `oneOf`, `furthest`, and the
nondeterministic selectors inspect alternatives but withhold a result while an
alternative remains unresolved. Fatal failures stop evaluation immediately.

## Fenced blocks

`manyTill` checks its terminator before reading another content value. A partial
closing fence therefore keeps the parser pending instead of consuming the
backticks as body text:

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

The success value is `"const answer = 42;\n"`. A triple-backtick sequence inside
a code line or at the start of a longer line remains content. LF and CRLF line
endings are accepted. The terminator is consumed and removed from the mapped
output.

## Buffering and backpressure

Streaming is buffered rather than continuation-based. `createStreamingParser`
and `parseStream` retain all accumulated text and rerun the grammar from the
start after each feed. `parseStreamEach` compacts completed prefixes between
chunk batches but retains the incomplete current value.

The async helpers apply pull backpressure between source chunks. The next chunk
is not requested until the consumer asks for more results. `parseStreamEach`
also applies record-level backpressure inside a large chunk. It yields each
result before parsing the next available value.

There is no built-in buffer limit. Use sensible chunk sizes and enforce
protocol-level limits for untrusted or indefinitely incomplete input. Retaining
old `Result` objects can also retain their older context strings after internal
compaction.

Because the grammar is rerun, parsers and mapping callbacks should avoid
observable side effects. Logging, mutation, ID allocation, and counters may run
again for the same successful prefix after another chunk arrives.

## Custom parsers

A streaming-aware custom parser should:

- preserve `ctx.text` and `ctx.final`, preferably with `{ ...ctx, index }`
- return `pending(...)` only while `ctx.final === false`
- treat `final === undefined` as ordinary finite input
- never move the index backwards on success
- consume input on success when used with repetition or `parseStreamEach`

```ts
import { failure, pending, type Parser, success } from "@claudiu-ceia/combine";

const asciiWord: Parser<string> = (ctx) => {
  let end = ctx.index;

  while (end < ctx.text.length) {
    const code = ctx.text.charCodeAt(end);
    const letter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    if (!letter) break;
    end++;
  }

  if (end === ctx.index) {
    return end === ctx.text.length && ctx.final === false
      ? pending(ctx, "ASCII word")
      : failure(ctx, "ASCII word");
  }

  if (end === ctx.text.length && ctx.final === false) {
    return pending({ ...ctx, index: end }, "word boundary");
  }

  return success({ ...ctx, index: end }, ctx.text.slice(ctx.index, end));
};
```

The index in a pending context is diagnostic. It is not a continuation cursor.
The complete grammar runs again after the next feed.

## Lexer behavior

`lexeme`, `symbol`, and `keyword` consume trailing trivia. At an open buffer
boundary, a complete token can therefore remain pending while whitespace or a
comment may still follow. A following nontrivia character closes the token and
remains unread.

`keyword("let")` also waits at exact input `"let"` until another character or
finalization establishes the identifier boundary. `lineComment()` waits for LF
or finalization and leaves LF unread. An unterminated final `blockComment()` is
fatal.

Generic `regex(...)` remains pending until finalization even when wrapped in
`lexeme`. Use a custom streaming-aware token parser when values must be emitted
before the complete source ends.

## Text decoding and offsets

Chunk boundaries have no grammatical meaning. Tokens, comments, delimiters,
fixed strings, and CRLF sequences can span any number of chunks.

The helpers accept `AsyncIterable<string>`. Decode byte streams incrementally
with `TextDecoderStream`, Node's `setEncoding("utf8")`, or
`TextDecoder.decode(..., { stream: true })`. Decoding each byte chunk separately
can corrupt a UTF-8 character split across chunks.

```ts
import { type Parser } from "@claudiu-ceia/combine";
import { parseStream } from "@claudiu-ceia/combine/streaming";

declare const parser: Parser<unknown>;
declare const response: Response;

const strings = response.body!.pipeThrough(new TextDecoderStream());

for await (const result of parseStream(parser, strings)) {
  // Handle pending and terminal states.
}
```

All context indices and spans remain UTF-16 code-unit offsets, matching normal
JavaScript string APIs.
