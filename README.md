# combine

Typed parser combinators for TypeScript (Deno + Node). Build small parsers, then
compose them into a grammar.

[![CI](https://github.com/ClaudiuCeia/combine/actions/workflows/ci.yml/badge.svg)](https://github.com/ClaudiuCeia/combine/actions/workflows/ci.yml)
[![JSR](https://jsr.io/badges/@claudiu-ceia/combine)](https://jsr.io/@claudiu-ceia/combine)
[![npm](https://img.shields.io/npm/v/@claudiu-ceia/combine)](https://www.npmjs.com/package/@claudiu-ceia/combine)

## Install

### Deno (JSR)

```ts
import { seq, str } from "jsr:@claudiu-ceia/combine@^0.2.5";
```

### Node (npm)

```sh
npm i @claudiu-ceia/combine
```

```ts
import { seq, str } from "@claudiu-ceia/combine";
```

## Quickstart

Parsers are plain functions: `(ctx) => Result<T>`. The context tracks where you
are in the input: `{ text, index }`.

```ts
import {
  eof,
  map,
  optional,
  regex,
  seq,
  space,
  str,
  trim,
} from "@claudiu-ceia/combine";

const name = trim(regex(/[^!]+/, "name"));
const hello = map(
  seq(str("Hello,"), optional(space()), name, str("!"), eof()),
  ([, , who]) => who,
);

const result = hello({ text: "Hello, World!", index: 0 });

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
- Composition: `seq`, `any`, `either`, `oneOf`, `many`, `many1`, `optional`
- Transform: `map`, `mapJoin`, `trim`

If you like learning by examples, start with `tests/`.

## Recursion (Grammars)

When a parser needs to reference itself (directly or indirectly), wrap the
reference with `lazy`:

```ts
import { any, lazy, map, type Parser, seq, str } from "@claudiu-ceia/combine";

type Expr = { kind: "paren"; inner: Expr } | { kind: "lit"; value: string };

const lit: Parser<Expr> = map(str("x"), (value) => ({ kind: "lit", value }));
const paren: Parser<Expr> = map(
  seq(str("("), lazy(() => expr), str(")")),
  ([, inner]) => ({ kind: "paren", inner }),
);

// A tiny recursive expression: x | (expr)
const expr: Parser<Expr> = any(lit, paren);
```

If you're defining a larger mutually-recursive grammar, use `createLanguage`
(`src/language.ts`) to avoid worrying about declaration order.

If you want better type inference without writing an explicit language type, use
`createLanguageThis` (see `docs/guide.md`).

## Better Errors

For user-facing parsers, wrap important nodes with `context(...)`, and commit to
branches with `cut(...)` (to avoid confusing backtracking). To print failures:

```ts
import { formatErrorStack } from "@claudiu-ceia/combine";

if (!result.success) console.error(formatErrorStack(result));
```

## More Examples

- `tests/` has the most coverage and real usage patterns
- `examples/` contains small runnable snippets

## Guides

If you want the deeper explanations (recursion patterns, `createLanguage`, error
handling, `cut` vs `context`, and `any` vs `furthest`), see `docs/guide.md`.

## License

MIT © [Claudiu Ceia](https://github.com/ClaudiuCeia)
