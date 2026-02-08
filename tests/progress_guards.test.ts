import { assertEquals } from "@std/assert";
import { chainl1, chainr1, many, manyTill, sepBy } from "../src/combinators.ts";
import type { Parser } from "../src/Parser.ts";
import { success } from "../src/Parser.ts";
import { str } from "../src/parsers.ts";

const epsilon = <T>(value: T): Parser<T> => {
  return (ctx) => success(ctx, value);
};

Deno.test("many fails fast on non-advancing parser", () => {
  const p = many(epsilon("x"));
  const res = p({ text: "abc", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected.includes("many"), true);
});

Deno.test("manyTill fails fast on non-advancing parser when end never matches", () => {
  const p = manyTill(epsilon("x"), str("END"));
  const res = p({ text: "abc", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected.includes("manyTill"), true);
});

Deno.test("sepBy fails fast on non-advancing element parser", () => {
  const p = sepBy(epsilon("x"), str(","));
  const res = p({ text: "abc", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected.includes("sepBy"), true);
});

Deno.test("chainl1 fails fast on non-advancing op/term loop", () => {
  const p = chainl1(epsilon(1), epsilon("+"), (l) => l);
  const res = p({ text: "abc", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected.includes("chainl1"), true);
});

Deno.test("chainr1 fails fast on non-advancing op/term loop", () => {
  const p = chainr1(epsilon(1), epsilon("+"), (l) => l);
  const res = p({ text: "abc", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected.includes("chainr1"), true);
});
