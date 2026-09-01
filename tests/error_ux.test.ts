import { assertEquals, assertStrictEquals } from "./assert.ts";
import { expect, test } from "bun:test";
import {
  any,
  chainl1,
  chainr1,
  furthest,
  manyTill,
  oneOf,
  optional,
  peek,
  sepBy,
  seq,
} from "../src/combinators.ts";
import {
  failure,
  formatErrorCompact,
  formatErrorReport,
  formatErrorSnippet,
  type Parser,
} from "../src/Parser.ts";
import { str } from "../src/parsers.ts";
import { cut } from "../src/utility.ts";

test("any returns the failure that got furthest when all alternatives fail", () => {
  const p1 = seq(str("a"), str("b")); // fails at index 1 on "aX"
  const p2 = seq(str("a"), str("X"), str("Y")); // fails at index 2 on "aXz"

  const res = any(p1, p2)({ text: "aXz", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.expected, "Y");
    assertEquals(res.ctx.index, 2);
    assertEquals(res.variants, []);
  }
});

test("choice combinators aggregate tied failures", () => {
  const parsers = [
    any(str("if"), str("if"), str("while")),
    oneOf(str("if"), str("if"), str("while")),
    furthest(str("if"), str("if"), str("while")),
  ];

  for (const parser of parsers) {
    const res = parser({ text: "match", index: 0 });
    assertEquals(res.success, false);
    if (!res.success) {
      assertEquals(res.expected, "one of if, while");
      assertEquals(
        res.variants.map((variant) => variant.expected),
        ["if", "while"],
      );
      assertEquals(formatErrorCompact(res), "expected one of if, while at 1:1");
    }
  }
});

test("any propagates fatal errors immediately (no backtracking)", () => {
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

test("exhaustive choice combinators propagate fatal errors immediately", () => {
  for (const makeParser of [oneOf<string>, furthest<string>]) {
    let secondTried = false;
    const other: Parser<string> = (ctx) => {
      secondTried = true;
      return failure(ctx, "other");
    };

    const parser = makeParser(cut(str("a"), "committed"), other);
    const res = parser({ text: "b", index: 0 });

    assertEquals(res.success, false);
    if (!res.success) {
      assertEquals(res.fatal, true);
      assertEquals(res.expected, "committed");
    }
    assertEquals(secondTried, false);
  }
});

test("formatErrorSnippet clamps when failure index is out of bounds", () => {
  const text = "abc";
  const f = failure({ text, index: 999 }, "x");
  const snippet = formatErrorSnippet(f, { contextLines: 1, tabWidth: 2 });
  assertEquals(snippet.includes("expected x at line 1, column 4"), true);
  assertEquals(snippet.includes("^"), true);
});

test("formatErrorReport is a single message (no repeated header)", () => {
  const text = "abc";
  const f = failure({ text, index: 1 }, "x");
  const report = formatErrorReport(f, { contextLines: 1, tabWidth: 2 });
  assertEquals(report.split("expected x at line 1, column 2").length - 1, 1);
});

test("manyTill propagates fatal failures from the end parser", () => {
  const p = manyTill(str("a"), cut(str("END"), "end"));
  const res = p({ text: "aaaa", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.fatal, true);
    assertEquals(res.expected, "end");
  }
});

test("manyTill propagates fatal failures from the content parser", () => {
  const res = manyTill(
    cut(str("a"), "content"),
    str("END"),
  )({
    text: "x",
    index: 0,
  });

  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.fatal, true);
    assertEquals(res.expected, "content");
  }
});

test("sepBy propagates fatal failures from the separator", () => {
  const p = sepBy(str("a"), cut(str(","), "comma"));
  // First element matches, then separator fails fatally.
  const res = p({ text: "a;", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.fatal, true);
    assertEquals(res.expected, "comma");
  }
});

test("chainl1 propagates fatal failures from the operator parser", () => {
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

test("chainr1 propagates fatal failures from the operator parser", () => {
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

test("chain combinators propagate fatal right operand failures", () => {
  const term = any(str("a"), cut(str("b"), "right operand"));

  for (const parser of [
    chainl1(term, str("+"), (left) => left),
    chainr1(term, str("+"), (left) => left),
  ]) {
    const res = parser({ text: "a+", index: 0 });
    assertEquals(res.success, false);
    if (!res.success) {
      assertEquals(res.ctx.index, 2);
      assertEquals(res.fatal, true);
      assertEquals(res.expected, "right operand");
    }
  }
});

test("formatErrorSnippet preserves tabs when tab expansion is disabled", () => {
  const text = "\tvalue";
  const snippet = formatErrorSnippet(failure({ text, index: 1 }, "value"), {
    tabWidth: 0,
  });

  assertEquals(snippet.includes("1 | \tvalue"), true);
});

test("formatErrorSnippet normalizes hostile layout options", () => {
  const source = failure({ text: "a\n\tb", index: 3 }, "value");

  for (const options of [
    { contextLines: Number.NaN, tabWidth: Number.POSITIVE_INFINITY },
    { contextLines: -1, tabWidth: -1 },
    { contextLines: 1.5, tabWidth: 1.5 },
  ]) {
    expect(() => formatErrorSnippet(source, options)).not.toThrow();
    assertEquals(formatErrorSnippet(source, options).includes("^"), true);
  }
});

test("optional propagates fatal errors", () => {
  const p = optional(cut(str("x"), "x"));
  const res = p({ text: "y", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.fatal, true);
});

test("cut preserves failure variants and stack", () => {
  const ctx = { text: "x", index: 1 };
  const source = failure(
    ctx,
    "value",
    [failure(ctx, "alternative")],
    [{ label: "in value", location: { line: 1, column: 1 } }],
  );
  const res = cut(() => source, "expression")({ text: "x", index: 0 });

  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.expected, "expression");
    assertEquals(res.fatal, true);
    assertStrictEquals(res.variants, source.variants);
    assertStrictEquals(res.stack, source.stack);
  }
});

test("peek preserves failure metadata without consuming input", () => {
  const sourceCtx = { text: "x", index: 1 };
  const source = failure(
    sourceCtx,
    "value",
    [failure(sourceCtx, "alternative")],
    [{ label: "in value", location: { line: 1, column: 1 } }],
    true,
  );
  const res = peek(() => source)({ text: "x", index: 0 });

  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.ctx.index, 0);
    assertEquals(res.fatal, true);
    assertStrictEquals(res.variants, source.variants);
    assertStrictEquals(res.stack, source.stack);
  }
});
