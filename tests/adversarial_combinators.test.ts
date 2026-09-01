import { expect, test } from "bun:test";
import {
  assertEquals,
  assertObjectMatch,
  assertStrictEquals,
} from "./assert.ts";
import {
  any,
  chainl1,
  chainr1,
  choice,
  either,
  furthest,
  keepNonNull,
  many,
  many1,
  manyTill,
  minus,
  not,
  oneOf,
  optional,
  peek,
  repeat,
  sepBy,
  sepBy1,
  seq,
  seqNonNull,
  skip1,
  skipMany,
  skipMany1,
  surrounded,
} from "../src/combinators.ts";
import { failure, type Parser, success } from "../src/Parser.ts";
import { str } from "../src/parsers.ts";
import {
  attempt,
  chain,
  context,
  cut,
  ifPeek,
  lazy,
  map,
  mapJoin,
  mark,
  onFailure,
  peekAnd,
  trim,
  withSpan,
} from "../src/utility.ts";

test("failure-catching combinators never swallow fatal failures", () => {
  const ctx = { text: "x", index: 0 };
  const variant = failure(ctx, "variant");
  const source = failure(
    ctx,
    "committed",
    [variant],
    [{ label: "probe", location: { line: 1, column: 1 } }],
    true,
  );
  const fatal: Parser<string> = () => source;
  const exact: Parser<unknown>[] = [
    any(fatal, str("x")),
    oneOf(fatal, str("x")),
    furthest(fatal, str("x")),
    optional(fatal),
    many(fatal),
    many1(fatal),
    manyTill(str("x"), fatal),
    repeat(1, fatal),
    sepBy(fatal, str(",")),
    sepBy1(fatal, str(",")),
    skipMany(fatal),
    skipMany1(fatal),
    skip1(fatal),
    minus(str("x"), fatal),
    not(fatal),
    ifPeek(fatal, str("x")),
  ];

  for (const parser of exact) {
    assertStrictEquals(parser(ctx), source);
  }

  for (const parser of [peek(fatal), peekAnd(fatal, str("x"))]) {
    const res = parser(ctx);
    assertEquals(res.success, false);
    if (!res.success) {
      assertEquals(res.fatal, true);
      assertStrictEquals(res.variants, source.variants);
      assertStrictEquals(res.stack, source.stack);
      assertEquals(res.ctx, ctx);
    }
  }
});

test("diagnostics accept arbitrary parser values without throwing", () => {
  const ctx = { text: "x", index: 0 };
  const circular: { self?: unknown } = {};
  circular.self = circular;
  const hostile = {
    self: undefined as unknown,
    toString: () => {
      throw new Error("cannot stringify");
    },
  };
  hostile.self = hostile;
  const values: unknown[] = [1n, Symbol("value"), undefined, circular, hostile];

  for (const value of values) {
    const matched: Parser<unknown> = (ctx) => success(ctx, value);
    const other: Parser<unknown> = (ctx) => success(ctx, "other");
    for (const parser of [
      oneOf(matched, other),
      minus(str("x"), matched),
      not(matched),
    ]) {
      expect(() => parser(ctx)).not.toThrow();
      assertEquals(parser(ctx).success, false);
    }
  }
});

test("manyTill returns a farther content failure than its end failure", () => {
  const res = manyTill(
    seq(str("a"), str("b")),
    str("END"),
  )({
    text: "aX",
    index: 0,
  });

  assertObjectMatch(res, {
    success: false,
    expected: "b",
    ctx: { index: 1 },
  });
});

test("failure merging does not interpret custom expectations as metadata", () => {
  const ctx = { text: "x", index: 0 };
  const detail = failure(ctx, "detail");
  const source = failure(
    ctx,
    "one of declarations",
    [detail],
    [{ label: "in declaration", location: { line: 1, column: 1 } }],
  );
  const res = any(
    () => source,
    () => failure(ctx, "expression"),
  )(ctx);

  assertEquals(res.success, false);
  if (!res.success) {
    expect(res.variants).toContain(source);
    assertStrictEquals(
      res.variants.find((variant) => variant === source)?.stack,
      source.stack,
    );
  }
});

test("failure merging survives context wrappers without duplicate variants", () => {
  for (const parser of [
    any(context("inner", any(str("a"), str("b"))), str("c")),
    oneOf(context("inner", any(str("a"), str("b"))), str("c")),
    furthest(context("inner", any(str("a"), str("b"))), str("c")),
  ]) {
    const res = parser({ text: "x", index: 0 });

    assertEquals(res.success, false);
    if (!res.success) {
      assertEquals(res.expected, "one of a, b, c");
      assertEquals(
        res.variants.map((variant) => variant.expected),
        ["a", "b", "c"],
      );
    }
  }
});

test("failure merging preserves rewritten aggregate expectations", () => {
  const res = any(
    attempt(cut(any(str("a"), str("b")), "letter")),
    str("c"),
  )({ text: "x", index: 0 });

  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.expected, "one of letter, a, b, c");
    assertEquals(
      res.variants.map((variant) => variant.expected),
      ["letter", "a", "b", "c"],
    );
  }
});

test("onFailure preserves the original failure once without duplicating variants", () => {
  const ctx = { text: "x", index: 0 };
  const alternative = failure(ctx, "alternative");
  const source = failure(ctx, "original", [alternative]);
  const res = onFailure(
    () => source,
    (failed) => ({ ...failed, expected: "rewritten" }),
  )(ctx);

  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.variants.length, 2);
    assertStrictEquals(res.variants[0], alternative);
    assertStrictEquals(res.variants[1], source);
  }
});

test("onFailure preserves identity when the callback makes no change", () => {
  const ctx = { text: "x", index: 0 };
  const source = failure(ctx, "original");
  const res = onFailure(
    () => source,
    (failed) => failed,
  )(ctx);

  assertStrictEquals(res, source);
});

test("all combinators preserve input text and valid cursor bounds", () => {
  const text = "a+a";
  const succeedsWithArray: Parser<(string | null)[]> = (ctx) =>
    success(ctx, ["a", null]);
  const cases: Array<{ parser: Parser<unknown>; index?: number }> = [
    { parser: seq(str("a"), str("+"), str("a")) },
    { parser: either(str("a"), str("b")) },
    { parser: any(str("a"), str("b")) },
    { parser: choice(str("a"), str("b")) },
    { parser: oneOf<string>(str("a"), str("b")) },
    { parser: furthest(str("a"), str("a+")) },
    { parser: optional(str("z")) },
    { parser: many(str("a")) },
    { parser: many1(str("a")) },
    { parser: manyTill(str("a"), str("+")) },
    { parser: repeat(2, str("a")) },
    { parser: sepBy(str("a"), str("+")) },
    { parser: sepBy1(str("a"), str("+")) },
    { parser: skipMany(str("a")) },
    { parser: skipMany1(str("a")) },
    { parser: peek(str("a")) },
    { parser: skip1(str("a")) },
    { parser: surrounded(str("a"), str("+"), str("a")) },
    { parser: minus(str("a"), str("z")) },
    { parser: not(str("z")) },
    { parser: keepNonNull(succeedsWithArray) },
    {
      parser: seqNonNull(
        str("a"),
        map(str("+"), () => null),
      ),
    },
    { parser: chainl1(str("a"), str("+"), (left) => left) },
    { parser: chainr1(str("a"), str("+"), (left) => left) },
    { parser: map(str("a"), (value) => value) },
    { parser: chain(str("a"), () => str("+")) },
    { parser: mapJoin(map(str("a"), (value) => [value])) },
    { parser: lazy(() => str("a")) },
    { parser: peekAnd(str("a"), str("a")) },
    { parser: ifPeek(str("a"), str("+")) },
    { parser: onFailure(str("a"), (failed) => failed) },
    { parser: trim(str("a")) },
    { parser: mark(str("a")) },
    { parser: withSpan(str("a")) },
    { parser: context("value", str("a")) },
    { parser: cut(str("a")) },
    { parser: attempt(str("a")) },
  ];

  for (const { parser, index = 0 } of cases) {
    const res = parser({ text, index });
    assertEquals(res.ctx.text, text);
    expect(res.ctx.index).toBeGreaterThanOrEqual(index);
    expect(res.ctx.index).toBeLessThanOrEqual(text.length);
  }
});

test("repeat has exact call-count semantics even for zero-width parsers", () => {
  let calls = 0;
  const epsilon: Parser<number> = (ctx) => {
    calls++;
    return success(ctx, calls);
  };

  assertObjectMatch(repeat(3, epsilon)({ text: "", index: 0 }), {
    success: true,
    value: [1, 2, 3],
    ctx: { index: 0 },
  });
  assertEquals(calls, 3);

  repeat(0, epsilon)({ text: "", index: 0 });
  assertEquals(calls, 3);
});
