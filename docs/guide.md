# combine guide

This page collects the "deep dive" topics that are useful once you've built a
small parser and want to scale it to a real grammar.

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
  seq(str("("), lazy(() => expr), str(")")),
);
```

For a full example, see `tests/calculator.test.ts`.

## `createLanguage` (mutual recursion without worrying about order)

If you have a mutually-recursive grammar, manually threading `lazy()` everywhere
gets noisy. `createLanguage` lets you define a "language object" where every
production can refer to `self.*` without caring about declaration order.

```ts
import { createLanguage, type Parser, seq, str } from "@claudiu-ceia/combine";

type Lang = {
  Atom: Parser<string>;
  Paren: Parser<string>;
};

const L = createLanguage<Lang>({
  Atom: () => str("x"),
  Paren: (s) => seq(str("("), s.Atom, str(")")),
});
```

Notes:

- `createLanguage` wraps definitions in `lazy()` internally, so there is a small
  overhead compared to hand-written parsers.
- For a typed example that exercises recursion, see `tests/language.test.ts`.

## `createLanguageThis` (recommended for type inference)

TypeScript often struggles to infer the `self` type for mutually-recursive
grammars. If you want good editor autocomplete without writing
`createLanguage<MyLang>({ ... })`, use `createLanguageThis`.

Instead of a `self` argument, definitions are methods and you reference other
productions via `this.*`:

```ts
import { createLanguageThis, many, surrounded } from "@claudiu-ceia/combine";
import { number, regex, str } from "@claudiu-ceia/combine";

const L = createLanguageThis({
  Symbol() {
    return regex(/[a-zA-Z_-][a-zA-Z0-9_-]*/, "symbol");
  },
  Number() {
    return number();
  },
  Expression() {
    // The returned language object (`L`) is strongly typed.
    // Note: TypeScript may treat `this` as `any` inside these methods unless
    // the object literal is contextually typed; use `createLanguage<T>(...)`
    // if you want `self` to be fully typed inside definitions.
    return many(this.Symbol);
  },
  List() {
    return surrounded(str("("), many(this.Expression), str(")"));
  },
});
```

Type-check coverage for this lives in `tests/language_infer.test.ts`.

## Error handling (`context`, `cut`, `attempt`)

When you build user-facing parsers, you typically want:

- readable "where in the grammar did this fail?" traces
- fewer confusing backtracks once you've committed to a branch

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
  console.error(formatErrorReport(result)); // header + snippet + stack frames
  console.error(formatErrorSnippet(result)); // line snippet with caret
  console.error(formatErrorStack(result));
}
```
