import { assertEquals, assertObjectMatch } from "@std/assert";
import { failure, type Parser } from "../src/Parser.ts";
import { seq } from "../src/combinators.ts";
import { str } from "../src/parsers.ts";
import { map, onFailure, peekAnd, trim } from "../src/utility.ts";

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
