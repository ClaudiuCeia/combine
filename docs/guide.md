# combine guide

This page collects the "deep dive" topics that are useful once you've built a
small parser and want to scale it to a real grammar.

## Text and offsets

`Context.index`, `runParser` start offsets, and captured spans use UTF-16 code
unit offsets, matching JavaScript string APIs. The `char`, `anyChar`, `notChar`,
and `charWhere` primitives consume one UTF-16 code unit, so an astral character
such as an emoji occupies two positions.

Use a Unicode regular expression such as `regex(/./u, "Unicode code point")`
when a parser should consume a complete Unicode code point. Its matched string
may advance the context by two UTF-16 positions. The default `keyword` boundary
recognizes ASCII letters, digits, and underscores; grammars with Unicode
identifiers should define their own boundary parser.

## Streaming input

`createStreamingParser(parser)` runs a parser over an append-only buffer. Each
`feed(chunk)` evaluates the grammar with `Context.final === false`. `finish()`
marks the same buffer as final and produces an authoritative success or failure.
The current engine reruns the grammar against the accumulated text after each
chunk; the lifecycle does not expose that implementation detail to callers.

```ts
import {
  createStreamingParser,
  isPending,
  seq,
  str,
} from "@claudiu-ceia/combine";

const stream = createStreamingParser(seq(str("Content-Type"), str(":")));

const partial = stream.feed("Content-");
if (isPending(partial)) {
  const complete = stream.feed("Type:");
  // complete.success === true
}
```

A streaming result has three states:

- `result.success === true`: terminal success
- `isPending(result)`: more appended input may change the outcome
- otherwise: terminal failure

Sessions are single-use after a terminal result. Calling `feed()` after success
or definitive failure throws. Calling `finish()` more than once returns the same
terminal result.

Custom parser wrappers must forward the complete `Context`, including `final`,
when invoking another parser. Built-in combinators restore the session marker
between successful children for compatibility with wrappers that return a fresh
context, but cannot recover it if a wrapper removes it before delegation.

Use `parseStream(parser, chunks)` to consume an `AsyncIterable<string>`. Use
`parseStreamEach(parser, chunks, { until? })` when one source contains repeated
values. The repeated parser must consume input whenever it succeeds; otherwise
`parseStreamEach` returns a failure instead of looping forever.

`parseStreamEach` releases completed input between batches, so result contexts,
locations, and spans are relative to the currently retained buffer window. A
repeated-value parser must not depend on input before the current value.

### Open boundaries

Some otherwise-valid prefixes remain pending at the current end of an open
buffer. For example, `space()` cannot publish `" "` while another whitespace
character may arrive, and `number()` cannot publish `29` while `.8` may still
arrive. A delimiter or `finish()` closes those choices.

Ordered choice also remains pending when its selected branch is incomplete.
Selection combinators such as `oneOf` and `furthest` wait while an unresolved
alternative could change their result.

`regex(...)` is intentionally conservative: it remains pending for every open
input and evaluates only after finalization. JavaScript regular expressions do
not expose enough information to prove that an arbitrary match is stable under
appending. Use streaming-aware primitives or a custom `Parser` when early
emission is required.

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

For a full example, see `tests/calculator.test.ts`.

## `defineLanguage` (recommended for larger grammars)

If you have a mutually-recursive grammar, manually threading `lazy()` everywhere
gets noisy. `defineLanguage` uses a compact map of production output types and
gives every definition a fully typed view of the complete language.

```ts
import { defineLanguage, str, surrounded } from "@claudiu-ceia/combine";

type Grammar = {
  Atom: string;
  Paren: string;
};

const L = defineLanguage<Grammar>({
  Atom: () => str("x"),
  Paren: ({ Atom }) => surrounded(str("("), Atom, str(")")),
});
```

Notes:

- `defineLanguage` wraps definitions in `lazy()` internally, so declaration
  order does not matter.
- The schema contains parsed output types, not `Parser<...>` types.
- Wrong production return types are reported against the corresponding schema
  entry.
- For typed examples that exercise recursion, see
  `tests/define_language.test.ts`.

### Migrating from 0.3

Version 0.4 replaces `createLanguage` and `createLanguageThis` with the single
`defineLanguage` API. Schemas now describe parsed output values rather than
bound parser functions:

```ts
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
  - If all alternatives fail, it returns the failure that got the furthest
    (`ctx.index` is greatest).
  - Fatal failures (from `cut(...)`) stop immediately; later alternatives are
    not tried.
- `furthest(p1, p2, ...)` always tries all alternatives and returns the result
  (success or failure) that got the furthest.
  - This often improves error quality, but it may return a failure even if an
    earlier alternative succeeded.
- `oneOf(p1, p2, ...)` evaluates alternatives from the same starting context and
  succeeds only when exactly one matches. Use it to enforce mutually exclusive
  branches, not for ordinary ordered choice.

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

Commit to a branch. If the inner parser fails, the failure becomes **fatal** and
won't be swallowed by alternatives like `any(...)` or `either(...)`.

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
import { any, attempt } from "@claudiu-ceia/combine";

const parser = any(attempt(committedBranch), fallbackBranch);
```

### `any(...)` vs `furthest(...)`

- `any(...)` returns the first success. It's fast, but can prefer a "too-greedy"
  branch if an earlier alternative succeeds early.
- `furthest(...)` tries all branches and picks the one that consumed the most
  input, which often produces better error messages.

If you know a branch should be committed after some prefix, prefer `cut(...)` to
avoid both false successes and confusing backtracking.

### Formatting failures

```ts
import {
  formatErrorCompact,
  formatErrorReport,
  formatErrorSnippet,
  formatErrorStack,
} from "@claudiu-ceia/combine";

if (!result.success) {
  console.error(formatErrorCompact(result));
  // Recommended: a single, non-redundant message (header + snippet + stack).
  console.error(formatErrorReport(result));
  console.error(formatErrorSnippet(result)); // line snippet with caret
  console.error(formatErrorStack(result));
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

## Lexer layer (optional)

For larger grammars, it's common to separate "lexing" (whitespace/comments and
token-like units) from higher-level structure, otherwise every rule ends up
sprinkling `space()`/`regex()`/`optional(...)`.

This repo includes a minimal lexer layer that consumes trailing trivia and drops
it from the output.

Exports are in `src/lexer.ts`:

- `defaultTrivia()` skips whitespace plus `//` and `/* ... */` comments
- `lexeme(p, trivia?)` runs `p` and then consumes trailing trivia
- `symbol("...")` is `lexeme(str("..."))`
- `keyword("if")` like `symbol`, but enforces an identifier boundary (won't
  match `ifx`)
- `createLexer({ trivia? })` builds a small helper object around your trivia
  policy

Example:

```ts
import { any, createLexer, map, seq } from "@claudiu-ceia/combine";
import { eof, int } from "@claudiu-ceia/combine";

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
  map,
  seq,
} from "@claudiu-ceia/combine";
import { eof, int, regex } from "@claudiu-ceia/combine";

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
