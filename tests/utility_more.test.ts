import {
  assertEquals,
  assertObjectMatch,
  assertStrictEquals,
} from "@std/assert";
import { failure, type Parser } from "../src/Parser.ts";
import { seq } from "../src/combinators.ts";
import { digit, str, take } from "../src/parsers.ts";
import {
  chain,
  flatMap,
  lazy,
  map,
  onFailure,
  peekAnd,
  trim,
} from "../src/utility.ts";

Deno.test("chain selects the next parser from the parsed value", () => {
  const parser: Parser<string> = chain(digit(), (length) => take(length));
  assertObjectMatch(parser({ text: "3abc!", index: 0 }), {
    success: true,
    value: "abc",
    ctx: { index: 4 },
  });

  const firstFailure = parser({ text: "xabc", index: 0 });
  assertEquals(firstFailure.success, false);
  if (!firstFailure.success) assertEquals(firstFailure.ctx.index, 0);

  const nextFailure = parser({ text: "3ab", index: 0 });
  assertEquals(nextFailure.success, false);
  if (!nextFailure.success) assertEquals(nextFailure.ctx.index, 1);
});

Deno.test("flatMap aliases chain", () => {
  assertStrictEquals(flatMap, chain);
  assertObjectMatch(
    flatMap(str("a"), () => str("b"))({
      text: "ab",
      index: 0,
    }),
    {
      success: true,
      value: "b",
      ctx: { index: 2 },
    },
  );
});

Deno.test("map trace passes a measurement string when enabled", () => {
  let gotMeasurement: string | undefined;
  const p = map(
    str("a"),
    (v, _before, _after, measurement) => {
      gotMeasurement = measurement;
      return v;
    },
    { trace: true, name: "p" },
  );

  const res = p({ text: "a", index: 0 });
  assertEquals(res.success, true);
  assertEquals(typeof gotMeasurement, "string");
  assertEquals(Number.isFinite(Number(gotMeasurement)), true);
});

Deno.test("peekAnd runs second parser at original ctx on peek success", () => {
  const p = peekAnd(str("a"), seq(str("a"), str("b")));
  const res = p({ text: "ab", index: 0 });
  assertEquals(res.success, true);
  if (res.success) assertEquals(res.ctx.index, 2);
});

Deno.test("peekAnd fails when peek fails", () => {
  const p = peekAnd(str("a"), str("b"));
  const res = p({ text: "b", index: 0 });
  assertEquals(res.success, false);
});

Deno.test("onFailure can rewrite failures and preserves original as variants", () => {
  const bad: Parser<string> = (ctx) => failure(ctx, "orig");
  const p = onFailure(bad, (f) => ({ ...f, expected: "rewritten" }));

  const res = p({ text: "x", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.expected, "rewritten");
    assertEquals(res.variants.length >= 1, true);
    assertEquals(res.variants.some((v) => v.expected === "orig"), true);
  }
});

Deno.test("trim consumes optional surrounding whitespace", () => {
  assertObjectMatch(trim(str("a"))({ text: "  a\t", index: 0 }), {
    success: true,
    value: "a",
    ctx: { index: 4 },
  });
});

Deno.test("lazy constructs its parser once", () => {
  let calls = 0;
  const parser = lazy(() => {
    calls++;
    return str("value");
  });

  assertEquals(parser({ text: "value", index: 0 }).success, true);
  assertEquals(parser({ text: "value", index: 0 }).success, true);
  assertEquals(calls, 1);
});
