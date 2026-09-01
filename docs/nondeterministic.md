# Nondeterministic recognizers

Ordinary combinators choose one result. The nondeterministic module can keep
multiple successful alternatives that start at the same input position. This
is useful for tokenizers, overlapping prefixes, and tools that need to inspect
ambiguity directly.

```ts
import {
  allMatches,
  furthestAll,
  recognizeAt,
  step,
  type Recognition,
  type StepPolicy,
} from "@claudiu-ceia/combine/nondeterministic";
```

The same exports are available from the package root.

## Recognitions and cursor position

```ts
type Recognition<T> = Readonly<{
  value: T;
  ctx: Context;
}>;
```

`recognizeAt(...parsers)` runs every parser from the same context and returns
each successful value with the context where that match ends. Matches are
sorted by descending end index, with parser order preserved for ties.

The outer success context intentionally stays at the starting position. A
recognizer observes matches but does not choose which end position should become
the next parser position.

```ts
import { runParser, str } from "@claudiu-ceia/combine";
import { recognizeAt } from "@claudiu-ceia/combine/nondeterministic";

const operators = recognizeAt(str("="), str("=="));
const result = runParser(operators, "==");

if (result.success) {
  console.log(result.ctx.index); // 0
  console.log(result.value.map((match) => match.ctx.index)); // [2, 1]
}
```

If no parser succeeds, `recognizeAt` returns the failure that reached the
greatest index. A fatal failure stops evaluation immediately. In streaming mode,
an unresolved alternative keeps the recognizer pending because it may still
change the set or order of matches.

## Advancing with `step`

Do not put `recognizeAt(...)` directly inside `many(...)`. Its outer context does
not advance, so repetition rejects it with a progress failure.

`step(recognizer, policy?)` chooses an end position and returns a parser that can
be repeated safely. `StepPolicy` is `"furthest" | "shortest"`, and the default
is `"furthest"`.

`step` preserves the complete recognition array as its value. The policy changes
only the outer success context. It fails when the chosen match does not advance.

```ts
import { many, map, parseAll, str } from "@claudiu-ceia/combine";
import { recognizeAt, step } from "@claudiu-ceia/combine/nondeterministic";

const operator = map(
  step(recognizeAt(str("="), str("=="))),
  (matches) => matches[0]!.value,
);

const result = parseAll(many(operator), "===");
if (result.success) console.log(result.value); // ["==", "="]
```

Use the shortest policy only when the grammar intentionally advances to the
earliest matching end:

```ts
const shortest = step(recognizeAt(str("="), str("==")), "shortest");
```

## `furthestAll`

`furthestAll(...parsers)` collects the values of every success tied at the
greatest end index and advances to that index. Shorter successes are omitted.

For parsers matching `"a"`, `"ab"`, and another `"ab"` against `"ab"`, the
result contains the two longest values and advances by two UTF-16 code units.

This is useful when all maximal token interpretations matter but shorter prefix
matches do not.

## `allMatches`

`allMatches(...parsers)` returns every successful value, including values that
consume different lengths. Its outer context advances to the greatest successful
end index.

This differs from `recognizeAt` in two ways:

- the returned values do not include their individual end contexts
- the outer success context advances automatically

Use `recognizeAt` when each match end or a custom advancement policy matters.
Use `allMatches` when all values matter but continuation should start after the
longest one.

## Failure and streaming rules

All nondeterministic selectors:

- start every alternative from the same context
- propagate fatal failures immediately
- return the furthest failure when no alternative succeeds
- remain pending while an unresolved alternative could change the result

They do not provide error recovery. Wrap or compose them with the same
`context`, `cut`, `attempt`, and `onFailure` tools used by deterministic parsers.
