# combine guide

This page collects the "deep dive" topics that are useful once you've built a
small parser and want to scale it to a real grammar.

- [Text and offsets](#text-and-offsets)
- [Streaming input](#streaming-input)
- [Order and recursion](#order-and-recursion)
- [`defineLanguage`](#definelanguage-recommended-for-larger-grammars)
- [Version migrations](#version-migrations)
- [Error handling](#error-handling-context-cut-attempt)
- [Performance tracing](#perf-tracing-optional)
- [Lexer layer](#lexer-layer-optional)

## Text and offsets

`Context.index`, `runParser` start offsets, and captured spans use UTF-16 code
unit offsets, matching JavaScript string APIs. The `char`, `anyChar`, `notChar`,
and `charWhere` primitives consume one UTF-16 code unit, so an astral character
such as an emoji occupies two positions.

Use a Unicode regular expression such as `regex(/./u, "Unicode code point")`
when a parser should consume a complete Unicode code point. Its matched string
may advance the context by two UTF-16 positions. The default `keyword` boundary
recognizes ASCII letters, digits, and underscores. Grammars with Unicode
identifiers should define their own boundary parser.

## Streaming input

Streaming adds a provisional `Pending` result for append-only input. The
single-value session used by `createStreamingParser` and `parseStream` stops
after success or definitive failure. `parseStreamEach` continues after each
advancing success. Success still means a prefix match unless the grammar includes
`eof()`.

The [streaming guide](./streaming.md) documents `createStreamingParser`,
`parseStream`, `parseStreamEach`, open boundaries, buffering, source
backpressure, lexer behavior, and the contract for custom streaming parsers.

## Order and recursion

Parser combinators are functions, so order and recursion rules apply.

Example grammar (calculator):

```txt
expr   = term, expr1;
expr1  = "+", term, expr1 | "-", term, expr1 | ;
term   = factor, term1;
term1  = "*", factor, term1 | "/", factor, term1 | ;
factor = "(", expr, ")" | number;
number = digit, {digit};
digit  = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "0";
syntax = expr;
```

When parsers reference each other, you'll often need `lazy(() => ...)` to break
the immediate recursion:

```ts
import { any, lazy, type Parser, seq, str } from "@claudiu-ceia/combine";

type Expr = unknown;

const number: Parser<Expr> = str("0"); // placeholder

const expr: Parser<Expr> = any(
  number,
  seq(
    str("("),
    lazy(() => expr),
    str(")"),
  ),
);
```

For a full example, see the [calculator](../examples/calculator.ts).

## `defineLanguage` (recommended for larger grammars)

If you have a mutually-recursive grammar, manually threading `lazy()` everywhere
gets noisy. `defineLanguage` uses a compact map of production output types and
gives every definition a fully typed view of the complete language.

```ts
import {
  any,
  defineLanguage,
  map,
  parseAll,
  seq,
  str,
} from "@claudiu-ceia/combine";

type Expr =
  Readonly<{ kind: "atom" }> | Readonly<{ kind: "paren"; value: Expr }>;

type Grammar = {
  Expression: Expr;
  Atom: Expr;
  Paren: Expr;
};

const L = defineLanguage<Grammar>({
  Expression: ({ Atom, Paren }) => any(Atom, Paren),
  Atom: () => map(str("x"), () => ({ kind: "atom" }) as const),
  Paren: ({ Expression }) =>
    map(
      seq(str("("), Expression, str(")")),
      ([, value]) => ({ kind: "paren", value }) as const,
    ),
});

const result = parseAll(L.Expression, "((x))");
```

Notes:

- `defineLanguage` wraps definitions in `lazy()` internally, so declaration
  order does not matter.
- The schema contains parsed output types, not `Parser<...>` types.
- Wrong production return types are reported against the corresponding schema
  entry.
- For typed examples that exercise recursion, see
  [the language tests](../tests/define_language.test.ts).

## Version migrations

### Migrating from 0.3

Version 0.4 replaces `createLanguage` and `createLanguageThis` with the single
`defineLanguage` API. Schemas now describe parsed output values rather than
bound parser functions:

```text
// 0.3
type OldGrammar = {
  Atom: Parser<string>;
  Paren: Parser<string>;
};

const old = createLanguage<OldGrammar>({
  Atom: () => str("x"),
  Paren: (self) => surrounded(str("("), self.Atom, str(")")),
});

// 0.4
type Grammar = {
  Atom: string;
  Paren: string;
};

const language = defineLanguage<Grammar>({
  Atom: () => str("x"),
  Paren: ({ Atom }) => surrounded(str("("), Atom, str(")")),
});
```

For `createLanguageThis`, replace `this.Production` references with the typed
`self` parameter or destructure the required productions as shown above.

### Migrating from 0.4

Version 0.5 changes `sepBy` and `sepBy1` to return only parsed elements. The
separator parser still consumes input, but its value is no longer included in
the result:

```ts
import { int, sepBy, str } from "@claudiu-ceia/combine";

const values = sepBy(int(), str(","));
// 0.4: Parser<(number | string)[]>
// 0.5: Parser<number[]>
```

Remove any filtering that discarded separator values. A trailing separator now
fails at the position where the next element was expected, matching the
documented contract.

## Error handling (`context`, `cut`, `attempt`)

When you build user-facing parsers, you typically want:

- readable "where in the grammar did this fail?" traces
- fewer confusing backtracks once you've committed to a branch

### Error selection (`choice`/`any`, `oneOf`, and `furthest`)

Backtracking combinators need a rule for which error to return when multiple
alternatives fail.

- `any(p1, p2, ...)` tries alternatives in order and returns the first success.
  If all alternatives fail, it returns the failure with the greatest
  `ctx.index`. Fatal failures stop immediately, so later alternatives are not
  tried.
- `furthest(p1, p2, ...)` tries alternatives unless a fatal failure stops it and
  returns the result (success or failure) that got the furthest.
  - This often improves error quality, but it may return a failure even if an
    earlier alternative succeeded.
- `oneOf(p1, p2, ...)` checks alternatives from the same starting context and
  succeeds only when exactly one matches. A second success or fatal failure
  stops evaluation. Use it to enforce mutually exclusive branches, not for
  ordinary ordered choice.

Pending alternatives remain unresolved. `any` stops at its first pending branch,
while `oneOf` and `furthest` wait when a pending alternative could change their
decision. If a known prefix commits the grammar to one branch, place `cut(...)`
after that prefix to avoid false successes and confusing backtracking.

### `context(label, parser)`

Wrap a parser so failures get an extra stack frame:

```ts
import { context, letter, many1, seq, str } from "@claudiu-ceia/combine";

const identifier = context("in identifier", many1(letter()));
const declaration = context(
  "in declaration",
  seq(str("let"), str(" "), identifier),
);

const result = declaration({ text: "let 123", index: 0 });
// expected letter at line 1, column 5
//   in identifier at line 1, column 5
//   in declaration at line 1, column 1
```

### `cut(parser, expected?)`

Commit to a branch. If the inner parser fails definitively, the failure becomes
**fatal** and won't be swallowed by alternatives like `any(...)` or
`either(...)`. A streaming pending result remains nonfatal until it resolves.

```ts
import { cut, str } from "@claudiu-ceia/combine";

cut(str("then")); // fatal on failure, preserves expected
cut(str("then"), "'then' keyword"); // fatal on failure, overrides expected
```

### `attempt(parser)`

Convert a fatal failure back into a non-fatal one (restores backtracking).
Usually used only when you want a committed parse to be "catchable" in a very
specific place.

```ts
import { any, attempt, cut, str } from "@claudiu-ceia/combine";

const committedBranch = cut(str("x"));
const fallbackBranch = str("y");
const parser = any(attempt(committedBranch), fallbackBranch);
```

### Formatting failures

```ts
import {
  formatErrorCompact,
  formatErrorReport,
  formatErrorSnippet,
  formatErrorStack,
  parseAll,
  str,
} from "@claudiu-ceia/combine";

const parsed = parseAll(str("ready"), "reading");
if (!parsed.success) {
  console.error(formatErrorCompact(parsed));
  // Recommended: a single, non-redundant message (header + snippet + stack).
  console.error(formatErrorReport(parsed));
  console.error(formatErrorSnippet(parsed)); // line snippet with caret
  console.error(formatErrorStack(parsed));
}
```

## Perf tracing (optional)

For larger grammars it can be useful to measure where time goes. `createTracer`
lets you wrap parsers and collect per-parser call counts,
success/pending/failure, input consumed, and total/max time.

```ts
import {
  createTracer,
  formatTraceTable,
  seq,
  str,
} from "@claudiu-ceia/combine";

const tr = createTracer();

const word = tr.wrap("word", str("hello"));
const p = tr.wrap("seq", seq(word, str("!")));

const res = p({ text: "hello!", index: 0 });
if (res.success) {
  console.log(formatTraceTable(tr.rows()));
}
```

The [API reference](./api.md#tracing) lists every `TraceRow` field and the
`rows()` and `reset()` lifecycle.

## Lexer layer (optional)

For larger grammars, it's common to separate "lexing" (whitespace/comments and
token-like units) from higher-level structure, otherwise every rule ends up
sprinkling `space()`/`regex()`/`optional(...)`.

This repo includes a minimal lexer layer that consumes trailing trivia and drops
it from the output.

Lexer APIs are exported from `@claudiu-ceia/combine`:

- `lineComment()` skips `//` content but leaves the newline unread
- `blockComment()` skips `/* ... */` and makes an unterminated final comment
  fatal
- `defaultTrivia()` skips whitespace plus `//` and `/* ... */` comments
- `lexeme(p, trivia?)` runs `p` and then consumes trailing trivia
- `symbol("...")` is `lexeme(str("..."))`
- `keyword("if")` like `symbol`, but enforces an identifier boundary (won't
  match `ifx`)
- `createLexer({ trivia? })` builds a small helper object around your trivia
  policy, including `parens(p)`

These helpers consume trailing trivia only. Parse leading trivia once in the
entry production when a file may start with whitespace or comments. Generic
`regex(...)` waits for finalization in streaming mode, even inside `lexeme`.

Example:

```ts
import { any, createLexer, eof, int, map, seq } from "@claudiu-ceia/combine";

const L = createLexer();

const expr = any(
  L.lexeme(int()),
  map(seq(L.symbol("("), L.lexeme(int()), L.symbol(")")), ([, n]) => n),
);

const program = seq(expr, eof());
```

### With `defineLanguage`

The lexer layer and `defineLanguage` are complementary: the lexer keeps trivia
handling out of your productions, while `defineLanguage` handles mutual
recursion without worrying about declaration order.

```ts
import {
  any,
  createLexer,
  defineLanguage,
  eof,
  int,
  map,
  regex,
  seq,
} from "@claudiu-ceia/combine";

const Lx = createLexer();

type Expression = number | string;
type Grammar = {
  Ident: string;
  Atom: Expression;
  Expr: Expression;
  Program: Expression;
};

const Lang = defineLanguage<Grammar>({
  Ident: () => Lx.lexeme(regex(/[a-zA-Z_][a-zA-Z0-9_]*/, "identifier")),
  Atom: ({ Ident, Expr }) => {
    return any(
      Lx.lexeme(int()),
      Ident,
      map(seq(Lx.symbol("("), Expr, Lx.symbol(")")), ([, e]) => e),
    );
  },
  Expr: ({ Atom }) => Atom,
  Program: ({ Expr }) => {
    // Parse leading trivia once at the entry point.
    return map(seq(Lx.trivia, Expr, eof()), ([, e]) => e);
  },
});
```
