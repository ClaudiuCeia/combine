import { assertEquals } from "@std/assert";
import { recognizeAt, step } from "../src/nondeterministic.ts";
import { seq } from "../src/combinators.ts";
import { str } from "../src/parsers.ts";
import { cut, map } from "../src/utility.ts";

Deno.test("recognizeAt returns all matches (longest first) without consuming", () => {
  const a = map(str("a"), () => "a");
  const ab = map(str("ab"), () => "ab");

  const res = recognizeAt(a, ab)({ text: "ab", index: 0 });
  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.ctx.index, 0); // does not advance
    assertEquals(res.value.map((x) => x.value), ["ab", "a"]);
    assertEquals(res.value.map((x) => x.ctx.index), [2, 1]);
  }
});

Deno.test("recognizeAt returns furthest failure when none match", () => {
  const p1 = seq(str("a"), str("b")); // fails at index 1 on "aX"
  const p2 = seq(str("a"), str("X"), str("Y")); // fails at index 2 on "aXz"

  const res = recognizeAt(p1, p2)({ text: "aXz", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.ctx.index, 2);
    assertEquals(res.expected, "Y");
  }
});

Deno.test("recognizeAt propagates fatal failures immediately", () => {
  let secondTried = false;
  const fatal = cut(str("a"), "a");
  const other = map(str("b"), () => {
    secondTried = true;
    return "b";
  });

  const res = recognizeAt(fatal, other)({ text: "b", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.fatal, true);
  assertEquals(secondTried, false);
});

Deno.test("step(furthest) advances to the longest match", () => {
  const a = map(str("a"), () => "a");
  const ab = map(str("ab"), () => "ab");
  const p = step(recognizeAt(a, ab), "furthest");

  const res = p({ text: "ab", index: 0 });
  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.ctx.index, 2);
    assertEquals(res.value.map((x) => x.value), ["ab", "a"]);
  }
});

Deno.test("step(shortest) advances to the shortest match", () => {
  const a = map(str("a"), () => "a");
  const ab = map(str("ab"), () => "ab");
  const p = step(recognizeAt(a, ab), "shortest");

  const res = p({ text: "ab", index: 0 });
  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.ctx.index, 1);
    assertEquals(res.value.map((x) => x.value), ["ab", "a"]);
  }
});
