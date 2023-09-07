# combine

An implementation of [parser combinators](https://en.wikipedia.org/wiki/Parser_combinator) for [Deno](https://deno.land/). 

## Example

```ts
import { 
  seq, 
  str, 
  optional, 
  mapJoin, 
  manyTill, 
  anyChar, 
  space, 
  map 
} from "https://deno.land/x/combine@v0.0.10/mod.ts";

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

Borrowing a trick from [Parsimmon](https://github.com/jneen/parsimmon), we can use the `createLanguage` function to
define our grammar. This allows us to not worry about the order in which we
define parsers, and we get each parser defined as lazy for free (well, with some
minor computational cost). You can see a comparison of directly using the parser
vs `createLanguage` in
[this benchmark](https://github.com/ClaudiuCeia/combine/blob/main/bench/createLanguage_bench.ts),
and you can see another example in
[this other benchmark](https://github.com/ClaudiuCeia/combine/blob/main/bench/lisp_bench.ts).

Typing support for `createLanguage` is not great at the moment. There are two ways to use it:

```ts
import { 
  createLanguage, 
  either, 
  str, 
  Parser, 
  UntypedLanguage, 
  number 
} from "https://deno.land/x/combine@v0.0.10/mod.ts";

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
bring a small performance hit. In the future we should be able to apply `lazy()` only
where it's needed.

## Performance

Performance is an inherent challenge for parser combinators. It's easy to create
a parser that performs badly due to backtracking, or by using expensive
combinators like
[furthest](https://github.com/ClaudiuCeia/combine/blob/main/src/combinators.ts#L150).

With previous Deno versions, the performance of `combine` was abysmal. However,
the latest Deno version at the time of writing this (1.36.4) seems to perform
much better than Parsimmon (which I previously recommended as a faster alternative). 
See [this benchmark](https://github.com/ClaudiuCeia/combine/blob/main/bench/lisp_bench.ts)
for a comparison.

```
benchmark      time (avg)        iter/s             (min … max)       p75       p99      p995
--------------------------------------------------------------- -----------------------------


combine        69.01 µs/iter      14,490.2    (46.42 µs … 1.21 ms)  58.88 µs 348.59 µs 405.41 µs
parsimmon       1.21 ms/iter         828.5   (872.27 µs … 2.87 ms)   1.34 ms   2.07 ms   2.23 ms

summary
  parsimmon
   17.49x slower than combine
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
