import { test } from "bun:test";
import { assertEquals, assertStrictEquals } from "./assert.ts";
import {
  allMatches,
  furthestAll,
  type Recognition,
  recognizeAt,
  step,
} from "../src/nondeterministic.ts";
import { failure, fatalFailure, type Parser, success } from "../src/Parser.ts";

const at = <T>(value: T, index: number): Parser<T> => {
  return (ctx) => success({ text: ctx.text, index }, value);
};

const failAt = (expected: string, index: number): Parser<never> => {
  return (ctx) => failure({ text: ctx.text, index }, expected);
};

test("recognizeAt preserves parser order within ties and retains duplicates", () => {
  const res = recognizeAt(
    at("tie-1", 2),
    at("long", 3),
    at("tie-2", 2),
    at("long", 3),
  )({ text: "abcd", index: 0 });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(
      res.value.map((recognition) => recognition.value),
      ["long", "long", "tie-1", "tie-2"],
    );
    assertEquals(
      res.value.map((recognition) => recognition.ctx.index),
      [3, 3, 2, 2],
    );
    assertEquals(res.ctx, { text: "abcd", index: 0 });
  }
});

test("nonfatal failures do not outrank successful recognitions", () => {
  const ctx = { text: "x".repeat(100), index: 0 };

  const recognized = recognizeAt(
    at("short", 1),
    failAt("far failure", 99),
    at("long", 2),
  )(ctx);
  assertEquals(recognized.success, true);

  const furthest = furthestAll(
    at("short-1", 1),
    failAt("far failure", 99),
    at("short-2", 1),
  )(ctx);
  assertEquals(furthest.success, true);
  if (furthest.success) {
    assertEquals(furthest.value, ["short-1", "short-2"]);
    assertEquals(furthest.ctx.index, 1);
  }

  const all = allMatches(
    at("short", 1),
    failAt("far failure", 99),
    at("long", 2),
  )(ctx);
  assertEquals(all.success, true);
  if (all.success) {
    assertEquals(all.value, ["short", "long"]);
    assertEquals(all.ctx.index, 2);
  }
});

test("equal-index failure ties consistently preserve the first failure", () => {
  const ctx = { text: "x", index: 0 };
  const first = failure({ text: "x", index: 1 }, "first");
  const second = failure({ text: "x", index: 1 }, "second");

  assertStrictEquals(
    recognizeAt(
      () => first,
      () => second,
    )(ctx),
    first,
  );
  assertStrictEquals(
    furthestAll(
      () => first,
      () => second,
    )(ctx),
    first,
  );
  assertStrictEquals(
    allMatches(
      () => first,
      () => second,
    )(ctx),
    first,
  );
});

test("fatal failures after successes override them and skip later parsers", () => {
  const factories: Array<(...parsers: Parser<string>[]) => Parser<unknown>> = [
    (...parsers) => recognizeAt(...parsers),
    (...parsers) => furthestAll(...parsers),
    (...parsers) => allMatches(...parsers),
  ];

  for (const makeParser of factories) {
    const calls: string[] = [];
    const ok: Parser<string> = (ctx) => {
      calls.push("ok");
      return success({ text: ctx.text, index: 1 }, "ok");
    };
    const fatal: Parser<string> = (ctx) => {
      calls.push("fatal");
      return fatalFailure(ctx, "committed");
    };
    const later: Parser<string> = (ctx) => {
      calls.push("later");
      return success({ text: ctx.text, index: 2 }, "later");
    };

    const res = makeParser(ok, fatal, later)({ text: "abc", index: 0 });
    assertEquals(res.success, false);
    if (!res.success) {
      assertEquals(res.fatal, true);
      assertEquals(res.expected, "committed");
    }
    assertEquals(calls, ["ok", "fatal"]);
  }
});

test("step computes policies from unsorted custom recognitions", () => {
  const recognizer: Parser<Recognition<string>[]> = (ctx) =>
    success(ctx, [
      { value: "middle", ctx: { text: ctx.text, index: 3 } },
      { value: "short", ctx: { text: ctx.text, index: 2 } },
      { value: "long", ctx: { text: ctx.text, index: 4 } },
    ]);

  const furthest = step(
    recognizer,
    "furthest",
  )({
    text: "abcd",
    index: 1,
  });
  const shortest = step(
    recognizer,
    "shortest",
  )({
    text: "abcd",
    index: 1,
  });

  assertEquals(furthest.success && furthest.ctx.index, 4);
  assertEquals(shortest.success && shortest.ctx.index, 2);
});
