# combine

An implementation of
[parser combinators](https://en.wikipedia.org/wiki/Parser_combinator) for
TypeScript.

## Example

```ts
import {
  anyChar,
  manyTill,
  map,
  mapJoin,
  optional,
  seq,
  space,
  str,
} from "@claudiu-ceia/combine";

const helloWorldParser = seq(
  str("Hello,"),
  optional(space()),
  mapJoin(manyTill(anyChar(), str("!"))),
);

const worldRes = helloWorldParser({
  text: "Hello, World!",
  index: 0,
});

/**
{
  success: true,
  ctx: {
    text: "Hello, World!",
    index: 13
  },
}
*/

const nameParser = map(helloWorldParser, ([, , name]) => name);
const nameRes = nameParser({
  text: "Hello, Joe Doe!",
  index: 0,
});

/**
{
  success: true,
  value: "Joe Doe!",
  ctx: {
    text: "Hello, Joe Doe!",
    index: 15
  },
}
*/
```

For more examples,
[take a look at tests](https://github.com/ClaudiuCeia/combine/tree/main/tests).

## About

A parser combinator is a function that takes several parsers as input, and
returns a new parser. [combine](https://github.com/ClaudiuCeia/combine/) defines
a few such combinators depending on how the parsers should be combined,
[seq](https://github.com/ClaudiuCeia/combine/blob/main/src/combinators.ts#L42)
which takes a list of parser that are applied sequentially,
[oneOf](https://github.com/ClaudiuCeia/combine/blob/main/src/combinators.ts#L109)
which tries all parsers sequentially and applies the first one that's succesful,
[furthest](https://github.com/ClaudiuCeia/combine/blob/main/src/combinators.ts#L150)
which tries all parsers and applies the one that consumes the most input
[and more](https://github.com/ClaudiuCeia/combine/blob/main/src/combinators.ts).

Most included parsers are [LL(1)](https://en.wikipedia.org/wiki/LL_parser), with
some notable exceptions such as
[str](https://github.com/ClaudiuCeia/combine/blob/main/src/parsers.ts#L8) and
[regex](https://github.com/ClaudiuCeia/combine/blob/main/src/parsers.ts#L274).
Other LL(k) parsers library are the result of using combinators and are included
for convenience, like
[signed](https://github.com/ClaudiuCeia/combine/blob/main/src/parsers.ts#L259),
[horizontalSpace](https://github.com/ClaudiuCeia/combine/blob/main/src/parsers.ts#L189)
and [others](https://github.com/ClaudiuCeia/combine/blob/main/src/parsers.ts).

A couple of
[common utility functions](https://github.com/ClaudiuCeia/combine/blob/main/src/utility.ts)
are also included.

## Order and recursion

While you can use parsers as shown in the above example, that quickly becomes a
problem for some parsing tasks, like DSLs.

Take a simple calculator grammar defined as:

```
expr=term, expr1;
expr1="+",term,expr1|"-",term,expr1|;
term=factor, term1;
term1="*", factor, term1 | "/", factor, term1|;
factor="(", expr , ")" | number;
number=digit , {digit};
digit = "1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"0";
syntax=expr;
```

`expr` needs to be defined using `term` and `expr1`, so these two parsers need
to be defined first. But then `expr1` refers to itself which triggers an
infinite loop unless we use
[lazy](https://github.com/ClaudiuCeia/combine/blob/main/src/utility.ts#L29-L31).

An implementation of the above can be seen in the
[calculator test](https://github.com/ClaudiuCeia/combine/blob/main/tests/calculator.test.ts).

We can see that the parsers which depend on each other need to be declared using
a named function as opposed to `addop` and `mulop`. Also, in the `factor` parser
we need to use `lazy`, otherwise we'd trigger an infinite mutual recursion
where:

`factor` calls `expression` `expression` calls `factor` ...

### createLanguage

Borrowing a trick from [Parsimmon](https://github.com/jneen/parsimmon), we can
use the `createLanguage` function to define our grammar. This allows us to not
worry about the order in which we define parsers, and we get each parser defined
as lazy for free (well, with some minor computational cost). You can see a
comparison of directly using the parser vs `createLanguage` in
[this benchmark](https://github.com/ClaudiuCeia/combine/blob/main/bench/createLanguage_bench.ts),
and you can see another example in
[this other benchmark](https://github.com/ClaudiuCeia/combine/blob/main/bench/lisp_bench.ts).

Typing support for `createLanguage` is not great at the moment. There are two
ways to use it:

```ts
import { 
  createLanguage, 
  either, 
  str, 
  Parser, 
  UntypedLanguage, 
  number 
} from "@claudiu-ceia/combine";

/**
 * Untyped, provide `UntypedLanguage` as a type parameter.
 * This will make all of the grammar consist of Parser<unknown>,
 * but you at least get a mapping for the `self` parameter.
 */
const lang = createLanguage<UntypedLanguage>({
  Foo: (s) => either(s.Bar /* this is checked to exist */, number()),
  Bar: () => str("Bar"),
});

// Typed
type TypedLanguage = {
  Foo: Parser<string, number>,
  Bar: Parser<string>,
  // ...
}
const typedLang = createLanguage<TypedLanguage>({
  Foo: (s) => either(
    s.Bar // this is checked to exist with the expected type 
    number(),
  ),
  Bar: () => str("Bar"),
});
```

Note that for more complex grammar you generally need some sort of recursion.
For those cases, it can be tricky to define the `TypedLanguage`, have a look at
[this example](https://github.com/ClaudiuCeia/combine/blob/main/tests/language.test.ts)
for inspiration.

Note that since this wraps all of the functions in a `lazy()` closure, this also
bring a small performance hit. In the future we should be able to apply `lazy()`
only where it's needed.

## Error Handling

combine provides TypeScript-style error stack traces for better debugging. When
a parse fails, you get a detailed trace showing the context at each level of
your grammar.

### Error Stack

The `Failure` type includes a `stack` field containing error frames:

```ts
type ErrorFrame = {
  label: string; // Context description (e.g., "in match expression")
  location: { line: number; column: number };
};

type Failure = {
  success: false;
  expected: string; // What was expected (from innermost parser or cut)
  ctx: Context;
  location: { line: number; column: number };
  variants: Failure[]; // Alternative failures from `any`/`either`
  stack: ErrorFrame[]; // Error causation chain (innermost first)
  fatal: boolean; // If true, won't backtrack in any/either
};
```

### The `context` combinator

Add a stack frame to parser errors using `context`. This tells the user **where
in the grammar** the error occurred:

```ts
import { context, letter, many1, seq, str } from "@claudiu-ceia/combine";

const identifier = context("in identifier", many1(letter()));
const declaration = context(
  "in declaration",
  seq(str("let"), str(" "), identifier),
);

const result = declaration({ text: "let 123", index: 0 });
// Error: expected letter at 1:5
//   in identifier at 1:5
//   in declaration at 1:1
```

Key points:

- Each `context` wrapping a **failing** parser adds one frame to the stack
- Frames are added as the failure bubbles up: innermost first, outermost last
- On **success**, `context` is a no-op (no frame added)

### The `cut` combinator

Mark a point of no return with `cut`. After a cut, failures become "fatal" and
won't be caught by alternative parsers like `any` or `either`.

`cut` does two things:

1. **Always:** Makes the failure fatal (prevents backtracking)
2. **Optionally:** Overrides the `expected` message if you provide a second
   argument

```ts
// cut(parser) — fatal failure, keeps original expected message
cut(str("then"));
// Failure: { expected: "then", fatal: true }

// cut(parser, "message") — fatal failure, overrides expected message
cut(str("then"), "'then' keyword after condition");
// Failure: { expected: "'then' keyword after condition", fatal: true }
```

### `context` vs `cut` — when to use which

|                       | `context("label", parser)` | `cut(parser, "label")` |
| --------------------- | -------------------------- | ---------------------- |
| **Purpose**           | WHERE in grammar           | WHAT was expected      |
| **Adds to stack?**    | Yes                        | No                     |
| **Changes expected?** | No                         | Yes                    |
| **Makes fatal?**      | No                         | Yes                    |

You can combine both for rich error messages:

```ts
// Stack frame AND custom expected message
context("in then keyword", cut(str("then"), "'then' after condition"));
// Failure: { expected: "'then' after condition", stack: ["in then keyword"], fatal: true }
```

### Real-world example with `cut`

```ts
import {
  any,
  context,
  cut,
  letter,
  many1,
  map,
  seq,
  str,
} from "@claudiu-ceia/combine";

const identifier = map(many1(letter()), (ls) => ls.join(""));

// After seeing "if", we're committed - don't backtrack
const ifExpr = context(
  "in if expression",
  seq(
    str("if "),
    cut(seq( // everything after "if" is committed
      context("in condition", identifier),
      str(" "),
      context("in then keyword", str("then ")),
      context("in then branch", identifier),
      str(" "),
      context("in else keyword", str("else ")),
      context("in else branch", identifier),
    )),
  ),
);

// Without cut: if "then" is misspelled, `any` would backtrack and try
// whileExpr, forExpr, then identifier - giving a confusing error
const expr = any(ifExpr, whileExpr, forExpr, identifier);

// With cut: after matching "if ", we're committed to parsing an if-expression
const result = expr({ text: "if x thn y else z", index: 0 });
// Error: expected then at line 1, column 5
//   in then keyword at line 1, column 5
//   in if expression at line 1, column 1
```

### The `attempt` combinator

Convert a fatal error back to non-fatal, restoring backtracking. Use sparingly -
it defeats the purpose of `cut`:

```ts
import { any, attempt } from "@claudiu-ceia/combine";

// Without attempt: fatal error propagates, otherExpr is NEVER tried
const parser1 = any(ifExpr, otherExpr);

// With attempt: fatal converted to non-fatal, any() tries otherExpr
const parser2 = any(attempt(ifExpr), otherExpr);
```

### `any` vs `furthest` for error quality

`any` short-circuits on the first success. If a "greedy" parser like
`identifier` succeeds early, you may get wrong results:

```ts
const expr = any(ifExpr, whileExpr, identifier);
expr({ text: "if x thn y", index: 0 });
// SUCCESS: "if" — wrong! identifier matched the keyword
```

`furthest` tries all alternatives and picks the one that consumed the most
input:

```ts
const expr = furthest(ifExpr, whileExpr, identifier);
expr({ text: "if x thn y", index: 0 });
// FAILURE: expected "then" at position 5 — correct! ifExpr got furthest
```

Use `furthest` for better error messages, or use `cut` to prevent backtracking
to greedy alternatives.

### Formatting errors

Use the built-in formatters for error messages:

```ts
import { formatErrorCompact, formatErrorStack } from "@claudiu-ceia/combine";

if (!result.success) {
  // Multi-line trace
  console.log(formatErrorStack(result));
  // expected '}' at line 5, column 3
  //   in block at line 3, column 1
  //   in function declaration at line 2, column 1

  // Single-line summary
  console.log(formatErrorCompact(result));
  // expected '}' (in block) at 5:3
}
```

## Going forward

This started out as a learning exercise and it most likely will stay that way
for some time, or until it sees some real use. I'm not sure how much time I'll
be able to dedicate to this project, but I'll try to keep it up to date with
Deno releases.

### Major improvement opportunities:

- Tooling: tracing, profiling, etc.
- Nicer composition of parsers (avoid the
  [pyramid of doom](https://en.wikipedia.org/wiki/Pyramid_of_doom_(programming)))

## License

MIT © [Claudiu Ceia](https://github.com/ClaudiuCeia)
