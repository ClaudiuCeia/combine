import { assertEquals, assertStrictEquals } from "./assert.ts";
import { test } from "bun:test";
import { failure, parseAll, runParser } from "../src/Parser.ts";
import { str } from "../src/parsers.ts";

test("runParser starts at the requested index", () => {
  const res = runParser(str("value"), "skip value", 5);
  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, "value");
    assertEquals(res.ctx.index, 10);
  }
});

test("parseAll requires complete input consumption", () => {
  assertEquals(parseAll(str("value"), "value").success, true);

  const trailing = parseAll(str("value"), "value!");
  assertEquals(trailing.success, false);
  if (!trailing.success) {
    assertEquals(trailing.expected, "end of input");
    assertEquals(trailing.ctx.index, 5);
  }
});

test("parseAll preserves parser failures", () => {
  const sourceFailure = failure({ text: "bad", index: 2 }, "value");
  assertStrictEquals(
    parseAll(() => sourceFailure, "bad"),
    sourceFailure,
  );
});

test("parseAll supports empty input", () => {
  assertEquals(parseAll(str(""), "").success, true);
});
