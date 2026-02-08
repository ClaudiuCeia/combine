import { assertEquals } from "@std/assert";
import {
  chainl1,
  chainr1,
  keepNonNull,
  minus,
  oneOf,
  peek,
  seq,
  seqNonNull,
  skip1,
} from "../src/combinators.ts";
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
