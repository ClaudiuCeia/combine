# combine

An implementation of parser combinators for [Deno](https://deno.land/). Very much a work in progress.

## Example

```ts
const helloWorldParser = seq(
  str("Hello,"),
  optional(space()),
  mapJoin(manyTill(anyChar(), str("!")))
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

const nameParser = map(helloWorldParser, ([,,name]) => name);
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
