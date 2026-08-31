import { assertEquals, assertStrictEquals } from "./assert.ts";
import { test } from "bun:test";
import { failure } from "../src/Parser.ts";
import { mark, withSpan } from "../src/utility.ts";
import { str } from "../src/parsers.ts";

test("mark captures start/end indices", () => {
  const p = mark(str("abc"));
  const res = p({ text: "zabcq", index: 1 });
  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, { value: "abc", startIndex: 1, endIndex: 4 });
  }
});

test("withSpan captures locations on multiline input", () => {
  const p = withSpan(str("a\nb"));
  const res = p({ text: "a\nb", index: 0 });
  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value.start, 0);
    assertEquals(res.value.end, 3);
    assertEquals(res.value.locationStart, { line: 1, column: 1 });
    assertEquals(res.value.locationEnd, { line: 2, column: 2 });
  }
});

test("span combinators preserve parser failures", () => {
  const sourceFailure = failure({ text: "x", index: 0 }, "value");

  assertStrictEquals(
    mark(() => sourceFailure)({ text: "x", index: 0 }),
    sourceFailure,
  );
  assertStrictEquals(
    withSpan(() => sourceFailure)({ text: "x", index: 0 }),
    sourceFailure,
  );
});
