# API reference

Every API is exported from `@claudiu-ceia/combine`. The `nondeterministic`,
`perf`, and `streaming` subpaths provide narrower imports for those modules.

- [Parser model and runners](#parser-model-and-runners)
- [Primitive parsers](#primitive-parsers)
- [Composition](#composition)
- [Mapping, recursion, and spans](#mapping-recursion-and-spans)
- [Errors](#errors)
- [Languages](#languages)
- [Lexer](#lexer)
- [Tracing](#tracing)
- [Specialized modules](#specialized-modules)

## Parser model and runners

```ts
type Parser<T> = (ctx: Context) => Result<T>;

type Context = Readonly<{
  text: string;
  index: number;
  final?: boolean;
}>;

type Result<T> = Success<T> | Failure | Pending;
```

`Context.index` is a UTF-16 code-unit offset between `0` and `text.length`.
Ordinary finite parsing omits `final`. Streaming uses `false` while input is
open and `true` after explicit finalization.

| API                                                 | Contract                                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `runParser(parser, text, index?)`                   | Run from a UTF-16 offset. The default is `0`. An invalid offset returns a failure instead of throwing. Prefix success is allowed. |
| `parseAll(parser, text)`                            | Run from `0` and require the success context to reach `text.length`. Unread input becomes an `end of input` failure.              |
| `success(ctx, value)`                               | Construct a `Success<T>`.                                                                                                         |
| `failure(ctx, expected, variants?, stack?, fatal?)` | Construct a definitive `Failure`.                                                                                                 |
| `pending(ctx, expected, variants?, stack?)`         | Construct a provisional, nonfatal `Pending` result for open input.                                                                |
| `isPending(result)`                                 | Narrow a result to `Pending`.                                                                                                     |
| `fatalFailure(ctx, expected, stack?)`               | Construct a committed failure that backtracking combinators propagate.                                                            |
| `isFatal(failure)`                                  | Check the `fatal` flag.                                                                                                           |
| `getLocation(ctx)`                                  | Convert the context index to a 1-based line and column.                                                                           |
| `pushFrame(failure, label, ctx?)`                   | Add an `ErrorFrame` to a failure stack.                                                                                           |

A success contains `value` and the next `ctx`. A failure contains `expected`,
`ctx`, a precomputed `location`, equal-position `variants`, a contextual `stack`,
and `fatal`. Pending results carry the same diagnostic fields, plus
`pending: true`, but are not final errors.

The exported model types are `Parser`, `Context`, `Result`, `Success`, `Failure`,
`Pending`, and `ErrorFrame`. Error formatting also exports
`FormatErrorSnippetOptions` and `FormatErrorReportOptions`.

Custom parsers must preserve `ctx.text`, must not move the index backwards on
success, and must preserve `ctx.final`. See the [streaming guide](./streaming.md)
before returning pending results.

## Primitive parsers

| API                           | Output                      | Matches                                                                             |
| ----------------------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| `str(match)`                  | The literal type of `match` | One fixed string.                                                                   |
| `trie(matches)`               | `string`                    | The longest matching string. It is preferable to a large choice of fixed strings.   |
| `char(code)`                  | `string`                    | One UTF-16 code unit equal to `code`. Valid codes are `0` through `65535`.          |
| `anyChar()`                   | `string`                    | Any one UTF-16 code unit.                                                           |
| `notChar(code)`               | `string`                    | Any one UTF-16 code unit except `code`.                                             |
| `charWhere(predicate)`        | `string`                    | One UTF-16 code unit whose numeric code passes `predicate`.                         |
| `skipCharWhere(predicate)`    | `string \| null`            | The released type is wider, but every runtime success discards the value as `null`. |
| `digit()`                     | `number`                    | One ASCII digit, returned as `0` through `9`.                                       |
| `letter()`                    | `string`                    | One ASCII letter, `A-Z` or `a-z`.                                                   |
| `space()`                     | `string`                    | One or more JavaScript `\s` characters.                                             |
| `horizontalSpace()`           | `null`                      | One or more spaces or tabs.                                                         |
| `take(count)`                 | `string`                    | Exactly `count` UTF-16 code units.                                                  |
| `takeText()`                  | `string`                    | All input from the current position to the end.                                     |
| `eol()`                       | `string`                    | LF or CRLF. A lone CR does not match.                                               |
| `eof()`                       | `null`                      | The current position is the final end of input.                                     |
| `int()`                       | `number`                    | One or more ASCII digits forming a non-negative safe integer.                       |
| `double()`                    | `number`                    | A finite unsigned decimal with a dot. `29.` is valid.                               |
| `number()`                    | `number`                    | `double()` or `int()`. The result is unsigned.                                      |
| `signed(parser?)`             | `number`                    | An explicit `+` or `-`, followed by `parser` or `number()`.                         |
| `hexDigit()`                  | `string`                    | One ASCII hexadecimal digit.                                                        |
| `hex()`                       | `string`                    | One or more hexadecimal digits without a `0x` or `0X` prefix.                       |
| `regex(expression, expected)` | `string`                    | A sticky match at the current position. It never searches ahead.                    |

`char`, `anyChar`, `notChar`, `charWhere`, and `take` operate on UTF-16 code
units. Use a Unicode regular expression such as `regex(/./u, "code point")`
when one parser match must consume a complete Unicode code point.

Generic `regex` waits for finalization in streaming mode. The dedicated string,
character, whitespace, number, and trie parsers can make earlier decisions.

## Composition

### Sequence and alternatives

| API                    | Contract                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `seq(...parsers)`      | Run in order and return a typed tuple of values. At least one parser is required.                                            |
| `any(...parsers)`      | Ordered choice. Return the first success. `choice` is an alias and `either(a, b)` is the two-parser form.                    |
| `oneOf(...parsers)`    | Run alternatives from the same position and succeed only when exactly one matches. A second success is an ambiguity failure. |
| `furthest(...parsers)` | Return the success or failure that reaches the greatest index. Equal-position failures are merged.                           |
| `optional(parser)`     | Return the parser value or `null` after a definitive nonfatal mismatch.                                                      |

`any` stops at the first pending alternative because that alternative may still
win. `oneOf` and `furthest` withhold a result while an inspected alternative is
pending. Fatal failures stop all three forms immediately.

### Repetition and lists

| API                         | Contract                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `many(parser)`              | Match zero or more values.                                                          |
| `many1(parser)`             | Match one or more values.                                                           |
| `repeat(count, parser)`     | Match exactly a non-negative safe integer number of values.                         |
| `manyTill(parser, end)`     | Match values until `end` succeeds. The end value is appended to the returned tuple. |
| `sepBy(parser, separator)`  | Match zero or more values, discard separators, and reject a trailing separator.     |
| `sepBy1(parser, separator)` | The one-or-more form of `sepBy`.                                                    |
| `skipMany(parser)`          | The `many` behavior with a `null` result.                                           |
| `skipMany1(parser)`         | The `many1` behavior with a `null` result.                                          |

Every successful child of an unbounded repetition must advance the cursor.
Zero-width success becomes a descriptive failure instead of an infinite loop.
Pending and fatal failures propagate rather than ending repetition.

### Lookahead and output selection

| API                               | Contract                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `peek(parser)`                    | Require `parser` to match, return `null`, and leave the cursor unchanged.                                |
| `not(parser)`                     | Succeed with `null` only when `parser` definitively does not match. It never consumes.                   |
| `minus(parser, excluded)`         | Run `parser` only when `excluded` definitively does not match at the same position.                      |
| `peekAnd(probe, parser)`          | Require `probe`, then run `parser` from the original position.                                           |
| `ifPeek(probe, parser)`           | If `probe` succeeds, run `parser` from its end. Return `null` only after a definitive nonfatal mismatch. |
| `skip1(parser)`                   | Run one parser and discard its value.                                                                    |
| `surrounded(open, middle, close)` | Return only the middle value.                                                                            |
| `keepNonNull(parser)`             | Remove `null` values from a parsed array.                                                                |
| `seqNonNull(...parsers)`          | Sequence parsers and return only non-null values.                                                        |

Lookahead propagates pending and fatal results. It does not turn an unresolved
boundary into a match or mismatch.

### Expressions

| API                                | Contract                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `chainl1(term, operator, combine)` | Parse one or more terms and fold operators left. Use it for `a - b - c` as `(a - b) - c`.            |
| `chainr1(term, operator, combine)` | Parse one or more terms and fold operators right. Use it for exponentiation such as `a ** (b ** c)`. |

See the [calculator example](../examples/calculator.ts) for multiple precedence
levels and AST construction.

## Mapping, recursion, and spans

| API                   | Contract                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `map(parser, fn)`     | Transform a success value. `fn` also receives the before and after contexts.                                   |
| `chain(parser, next)` | Select the next parser from the first parsed value. `flatMap` is an alias.                                     |
| `mapJoin(parser)`     | Join a parsed `string[]` into one string.                                                                      |
| `lazy(() => parser)`  | Delay and cache parser construction. Use it to break recursive declarations.                                   |
| `trim(parser)`        | Consume optional `space()` before and after the parser. It does not trim or otherwise change the parsed value. |
| `mark(parser)`        | Return `{ value, startIndex, endIndex }`.                                                                      |
| `withSpan(parser)`    | Return the value, UTF-16 start/end indices, and start/end line and column.                                     |

The span result types are exported as `Marked<T>` and `WithSpan<T>`. `map` also
accepts an optional `{ trace: true, name }` argument and passes a timing string
as the callback's fourth argument. Prefer `createTracer` for aggregated parser
profiling.

`chain` is useful for value-directed formats:

```ts
import { chain, digit, map, take } from "@claudiu-ceia/combine";

const lengthPrefixed = chain(digit(), (length) =>
  map(take(length), (value) => ({ length, value })),
);
```

## Errors

| API                                     | Contract                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `context(label, parser)`                | Add a grammar frame to unsuccessful results.                                                     |
| `cut(parser, expected?)`                | Turn a definitive nonfatal failure into a fatal failure. Pending remains pending.                |
| `attempt(parser)`                       | Turn a fatal failure back into an ordinary failure.                                              |
| `onFailure(parser, rewrite)`            | Rewrite definitive failures while retaining the original as a variant. Pending is not rewritten. |
| `formatErrorCompact(failure)`           | Return one line with the immediate context and location.                                         |
| `formatErrorStack(failure)`             | Return the expected value, location, and grammar stack.                                          |
| `formatErrorSnippet(failure, options?)` | Add source lines and a caret. Options are `contextLines`, `tabWidth`, and `color`.               |
| `formatErrorReport(failure, options?)`  | Return one non-redundant header, snippet, and optional stack. It also accepts `stack: false`.    |

Place `cut` after the prefix that commits the grammar to one branch:

```ts
import { any, cut, seq, str } from "@claudiu-ceia/combine";

const statement = any(
  seq(str("let"), cut(str(" ")), cut(str("name"))),
  str("literal"),
);
```

## Languages

`defineLanguage<Outputs>(definitions)` builds a `Language<Outputs>`. Each
definition receives the complete language, so productions can reference each
other regardless of declaration order. `Language` and `LanguageDefinitions`
are exported for reusable annotations.

The output schema contains parsed values, not parser types:

```ts
import { any, defineLanguage, map, seq, str } from "@claudiu-ceia/combine";

type Node = string | Node[];
type Grammar = { Node: Node; List: Node[] };

const language = defineLanguage<Grammar>({
  Node: ({ List }) => any(str("x"), List),
  List: ({ Node }) => map(seq(str("("), Node, str(")")), ([, node]) => [node]),
});
```

## Lexer

Lexer APIs are exported from the package root. `TriviaParser` and `Lexer` are
the corresponding public types.

| API                        | Contract                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `lineComment()`            | Skip `//` through the character before LF. The LF remains unread.                                        |
| `blockComment()`           | Skip a non-greedy `/* ... */`. An unterminated final comment is fatal.                                   |
| `defaultTrivia()`          | Skip any number of whitespace, line comments, and block comments.                                        |
| `lexeme(parser, trivia?)`  | Parse a value and then consume trailing trivia.                                                          |
| `symbol(text, trivia?)`    | Parse a literal token and trailing trivia while preserving its literal type.                             |
| `keyword(text, trivia?)`   | Parse a literal token only when no ASCII identifier-continuation character follows, then consume trivia. |
| `createLexer({ trivia? })` | Return bound `trivia`, `lexeme`, `symbol`, `keyword`, and `parens` helpers.                              |

The lexer consumes trailing trivia only. Parse leading trivia once at the entry
production when a file may start with whitespace or comments.

## Tracing

`createTracer({ now? })` returns a `Tracer` with `wrap(name, parser)`, `rows()`,
and `reset()`. Parsers with the same name share one row. Rows are sorted by total
time and report calls, successes, pending results, failures, fatal failures,
consumed input, total milliseconds, and maximum call time. These records are
exported as `Tracer` and `TraceRow`.

`formatTraceTable(rows)` renders `TraceRow[]` for logs or terminals. The optional
`now` function is intended for deterministic tests.

```ts
import {
  createTracer,
  formatTraceTable,
  parseAll,
  str,
} from "@claudiu-ceia/combine";

const tracer = createTracer();
const parser = tracer.wrap("status", str("ready"));
parseAll(parser, "ready");
console.log(formatTraceTable(tracer.rows()));
```

## Specialized modules

- [Streaming](./streaming.md) documents `StreamingParser`,
  `StreamingParserOptions`, `createStreamingParser`, `parseStream`,
  `ParseStreamEachOptions`, and `parseStreamEach`. All streaming helpers accept
  `maxBufferLength`; retained buffers default to 1,048,576 UTF-16 code units.
- [Nondeterministic recognizers](./nondeterministic.md) document `Recognition`,
  `StepPolicy`, `recognizeAt`, `step`, `furthestAll`, and `allMatches`.
- Performance tracing is available from `@claudiu-ceia/combine/perf` as well as
  the root entrypoint.
