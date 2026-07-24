import { assertEquals, assertStrictEquals } from "@std/assert";
import {
  any,
  chainl1,
  chainr1,
  furthest,
  keepNonNull,
  minus,
  oneOf,
  peek,
  repeat,
  seq,
  seqNonNull,
  skip1,
} from "../src/combinators.ts";
import { failure, type Parser } from "../src/Parser.ts";
import { str } from "../src/parsers.ts";
import { map } from "../src/utility.ts";

Deno.test("seq fails when called with no parsers", () => {
  // `seq()` is valid at runtime but should fail (and is hard to type safely).
  const p = (seq as unknown as (...ps: unknown[]) => unknown)() as (
    ctx: { text: string; index: number },
  ) => unknown;
  const res = p({ text: "x", index: 0 }) as {
    success: boolean;
    expected?: string;
  };
  assertEquals(res.success, false);
  assertEquals(res.expected?.includes("at least one"), true);
});

Deno.test("oneOf fails when multiple alternatives match", () => {
  const p = oneOf(str("a"), str("a"));
  const res = p({ text: "a", index: 0 });
  assertEquals(res.success, false);
});

Deno.test("choice combinators fail when called without parsers", () => {
  const choices: [string, Parser<unknown>][] = [
    ["any", any()],
    ["oneOf", oneOf()],
    ["furthest", furthest()],
  ];

  for (const [name, parser] of choices) {
    const res = parser({ text: "x", index: 0 });
    assertEquals(res.success, false);
    if (!res.success) {
      assertEquals(res.expected, `${name}: expected at least one parser`);
    }
  }
});

Deno.test("peek fails without consuming input", () => {
  const p = peek(str("a"));
  const res = p({ text: "b", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.ctx.index, 0);
});

Deno.test("skip1 fails when inner parser fails", () => {
  const p = skip1(str("a"));
  const res = p({ text: "b", index: 0 });
  assertEquals(res.success, false);
});

Deno.test("minus fails when excluded parser matches", () => {
  const p = minus(str("a"), str("a"));
  const res = p({ text: "a", index: 0 });
  assertEquals(res.success, false);
});

Deno.test("keepNonNull filters nulls from array result", () => {
  const p = keepNonNull(map(seq(str("a"), str("b")), () => ["x", null, "y"]));
  const res = p({ text: "ab", index: 0 });
  assertEquals(res.success, true);
  if (res.success) assertEquals(res.value, ["x", "y"]);
});

Deno.test("seqNonNull sequences parsers and drops null results", () => {
  const p = seqNonNull(map(str("a"), () => "a"), map(str("b"), () => null));
  const res = p({ text: "ab", index: 0 });
  assertEquals(res.success, true);
  if (res.success) assertEquals(res.value, ["a"]);
});

Deno.test("chainl1 fails when operator matches but right operand does not", () => {
  const p = chainl1(str("a"), str("+"), (l) => l);
  const res = p({ text: "a+", index: 0 });
  assertEquals(res.success, false);
});

Deno.test("chainr1 fails when operator matches but right operand does not", () => {
  const p = chainr1(str("a"), str("+"), (l) => l);
  const res = p({ text: "a+", index: 0 });
  assertEquals(res.success, false);
});

Deno.test("repeat preserves the inner parser failure", () => {
  const ctx = { text: "x", index: 1 };
  const sourceFailure = failure(
    ctx,
    "item",
    [failure(ctx, "variant")],
    [{ label: "in item", location: { line: 1, column: 1 } }],
  );
  const parser: Parser<string> = () => sourceFailure;

  assertStrictEquals(repeat(1, parser)({ text: "x", index: 0 }), sourceFailure);
});
