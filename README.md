# combine

An implementation of parser combinators for [Deno](https://deno.land/). If
you're looking for production-ready code use
[Parsimmon](https://github.com/jneen/parsimmon).

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
} from "https://deno.land/x/combine@v0.0.9/mod.ts";

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

Borrowing a trick from Parsimmon, we can use the `createLanguage` function to
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
} from "https://deno.land/x/combine@v0.0.9/mod.ts";

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

Note that since this also wraps all of the functions in a `lazy()` closure, this does also 
bring a small performance hit. In the future we should be able to only apply `lazy()` only
where it's needed.

## Performance

Performance is an inherent challenge for parser combinators. It's easy to create
a parser that performs badly due to backtracking, or by using expensive
combinators like
[furthest](https://github.com/ClaudiuCeia/combine/blob/main/src/combinators.ts#L150).

For small inputs, `combine` performs ~3x slower than
[Parsimmon](https://github.com/jneen/parsimmon) (see
[benchmark](https://github.com/ClaudiuCeia/combine/blob/main/bench/lisp_bench.ts)),
but that gap widens even further as the input grows.

## Going forward

This started out as a learning exercise and it most likely will stay that way
for some time. There's no reason at the moment for anyone to be using this
instead of any other framework available for TypeScript - not in terms of
usability, and not in terms of performance or tooling. If this changes - then it
would make sense to get this out of pre-release.

### Major improvement opportunities:

- Address performance issues
- Tooling: tracing, profiling, etc.
- Nicer composition of parsers (avoid the
  [pyramid of doom](https://en.wikipedia.org/wiki/Pyramid_of_doom_(programming)))


## License

MIT © [Claudiu Ceia](https://github.com/ClaudiuCeia)
