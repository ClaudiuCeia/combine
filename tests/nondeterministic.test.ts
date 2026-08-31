import { assertEquals, assertStrictEquals } from "./assert.ts";
import { test } from "bun:test";
import { recognizeAt, step } from "../src/nondeterministic.ts";
import { seq } from "../src/combinators.ts";
import { failure, success } from "../src/Parser.ts";
import { str } from "../src/parsers.ts";
import { cut, map } from "../src/utility.ts";

test("recognizeAt returns all matches (longest first) without consuming", () => {
  const a = map(str("a"), () => "a");
  const ab = map(str("ab"), () => "ab");

  const res = recognizeAt(a, ab)({ text: "ab", index: 0 });
  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.ctx.index, 0); // does not advance
    assertEquals(
      res.value.map((x) => x.value),
      ["ab", "a"],
    );
    assertEquals(
      res.value.map((x) => x.ctx.index),
      [2, 1],
    );
  }
});

test("recognizeAt requires at least one parser", () => {
  const res = recognizeAt()({ text: "", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.expected, "recognizeAt: expected at least one parser");
  }
});

test("recognizeAt returns furthest failure when none match", () => {
  const p1 = seq(str("a"), str("b")); // fails at index 1 on "aX"
  const p2 = seq(str("a"), str("X"), str("Y")); // fails at index 2 on "aXz"

  const res = recognizeAt(p1, p2)({ text: "aXz", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.ctx.index, 2);
    assertEquals(res.expected, "Y");
  }
});

test("recognizeAt propagates fatal failures immediately", () => {
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

test("step(furthest) advances to the longest match", () => {
  const a = map(str("a"), () => "a");
  const ab = map(str("ab"), () => "ab");
  const p = step(recognizeAt(a, ab), "furthest");

  const res = p({ text: "ab", index: 0 });
  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.ctx.index, 2);
    assertEquals(
      res.value.map((x) => x.value),
      ["ab", "a"],
    );
  }
});

test("step(shortest) advances to the shortest match", () => {
  const a = map(str("a"), () => "a");
  const ab = map(str("ab"), () => "ab");
  const p = step(recognizeAt(a, ab), "shortest");

  const res = p({ text: "ab", index: 0 });
  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.ctx.index, 1);
    assertEquals(
      res.value.map((x) => x.value),
      ["ab", "a"],
    );
  }
});

test("step preserves recognizer failures", () => {
  const sourceFailure = failure({ text: "x", index: 0 }, "recognizer");
  const res = step(() => sourceFailure)({ text: "x", index: 0 });
  assertStrictEquals(res, sourceFailure);
});

test("step rejects an empty recognition set", () => {
  const res = step((ctx) => success(ctx, []))({ text: "x", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.expected, "step: expected at least one recognition");
  }
});

test("step rejects a selected recognition that does not advance", () => {
  const res = step(recognizeAt(str("")))({ text: "x", index: 1 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(
      res.expected,
      "step(furthest): recognizer did not advance (index 1 -> 1)",
    );
  }
});
