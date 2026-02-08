import { assertEquals } from "@std/assert";
import {
  any,
  chainl1,
  chainr1,
  manyTill,
  optional,
  sepBy,
  seq,
} from "../src/combinators.ts";
import {
  failure,
  formatErrorReport,
  formatErrorSnippet,
  type Parser,
} from "../src/Parser.ts";
import { str } from "../src/parsers.ts";
import { cut } from "../src/utility.ts";

Deno.test("any returns the failure that got furthest when all alternatives fail", () => {
  const p1 = seq(str("a"), str("b")); // fails at index 1 on "aX"
  const p2 = seq(str("a"), str("X"), str("Y")); // fails at index 2 on "aXz"

  const res = any(p1, p2)({ text: "aXz", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.expected, "Y");
    assertEquals(res.ctx.index, 2);
  }
});

Deno.test("any propagates fatal errors immediately (no backtracking)", () => {
  let secondTried = false;

  const fatalBranch = seq(str("if"), cut(str(" "), "space after if"));
  const other: Parser<string> = (ctx) => {
    secondTried = true;
    return failure(ctx, "other");
  };

  const res = any(fatalBranch, other)({ text: "ifthen", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.fatal, true);
    assertEquals(res.expected, "space after if");
  }
  assertEquals(secondTried, false);
});

Deno.test("formatErrorSnippet clamps when failure index is out of bounds", () => {
  const text = "abc";
  const f = failure({ text, index: 999 }, "x");
  const snippet = formatErrorSnippet(f, { contextLines: 1, tabWidth: 2 });
  assertEquals(snippet.includes("expected x at line 1, column 4"), true);
  assertEquals(snippet.includes("^"), true);
});

Deno.test("formatErrorReport is a single message (no repeated header)", () => {
  const text = "abc";
  const f = failure({ text, index: 1 }, "x");
  const report = formatErrorReport(f, { contextLines: 1, tabWidth: 2 });
  assertEquals(report.split("expected x at line 1, column 2").length - 1, 1);
});

Deno.test("manyTill propagates fatal failures from the end parser", () => {
  const p = manyTill(str("a"), cut(str("END"), "end"));
  const res = p({ text: "aaaa", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.fatal, true);
    assertEquals(res.expected, "end");
  }
});

Deno.test("sepBy propagates fatal failures from the separator", () => {
  const p = sepBy(str("a"), cut(str(","), "comma"));
  // First element matches, then separator fails fatally.
  const res = p({ text: "a;", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.fatal, true);
    assertEquals(res.expected, "comma");
  }
});

Deno.test("chainl1 propagates fatal failures from the operator parser", () => {
  const term = str("a");
  const op = cut(str("+"), "plus");
  const p = chainl1(term, op, (l) => l);
  const res = p({ text: "a-", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.fatal, true);
    assertEquals(res.expected, "plus");
  }
});

Deno.test("chainr1 propagates fatal failures from the operator parser", () => {
  const term = str("a");
  const op = cut(str("+"), "plus");
  const p = chainr1(term, op, (l) => l);
  const res = p({ text: "a-", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.fatal, true);
    assertEquals(res.expected, "plus");
  }
});

Deno.test("optional propagates fatal errors", () => {
  const p = optional(cut(str("x"), "x"));
  const res = p({ text: "y", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.fatal, true);
});
