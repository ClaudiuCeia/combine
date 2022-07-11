# combine

An implementation of parser combinators for [Deno](https://deno.land/). If you're looking
for production-ready code use [Parsimmon](https://github.com/jneen/parsimmon). 

## Example

```ts
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
[take a look at tests](https://github.com/ClaudiuCeia/combine/tree/main/src/tests).

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