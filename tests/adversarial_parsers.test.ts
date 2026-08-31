import { expect, test } from "bun:test";
import { assertEquals, assertObjectMatch } from "./assert.ts";
import { furthest, seq } from "../src/combinators.ts";
import { type Parser, runParser } from "../src/Parser.ts";
import {
  anyChar,
  char,
  charWhere,
  digit,
  double,
  eof,
  eol,
  hex,
  hexDigit,
  horizontalSpace,
  int,
  letter,
  notChar,
  number,
  regex,
  signed,
  skipCharWhere,
  space,
  str,
  take,
  takeText,
  trie,
} from "../src/parsers.ts";
import {
  blockComment,
  createLexer,
  defaultTrivia,
  keyword,
  lexeme,
  lineComment,
  symbol,
} from "../src/lexer.ts";

test("primitive parsers preserve input and cursor bounds at every legal offset", () => {
  const lexer = createLexer();
  const cases: Array<{ parser: Parser<unknown>; text: string }> = [
    { parser: str("a"), text: "ab" },
    { parser: trie(["", "a", "ab"]), text: "ab" },
    { parser: char(0x61), text: "ab" },
    { parser: anyChar(), text: "😀a" },
    { parser: notChar(0x62), text: "ab" },
    { parser: charWhere((code) => code === 0x61), text: "ab" },
    { parser: skipCharWhere((code) => code === 0x61), text: "ab" },
    { parser: digit(), text: "12x" },
    { parser: letter(), text: "a1" },
    { parser: space(), text: " \tX" },
    { parser: take(2), text: "abc" },
    { parser: takeText(), text: "abc" },
    { parser: eol(), text: "\r\n" },
    { parser: eof(), text: "a" },
    { parser: horizontalSpace(), text: " \tX" },
    { parser: int(), text: "123x" },
    { parser: double(), text: "12.5x" },
    { parser: hexDigit(), text: "Af" },
    { parser: hex(), text: "A12x" },
    { parser: number(), text: "12.5x" },
    { parser: signed(), text: "-12x" },
    { parser: regex(/./u, "code point"), text: "😀a" },
    { parser: lineComment(), text: "//x\n" },
    { parser: blockComment(), text: "/*x*/y" },
    { parser: defaultTrivia(), text: " /*x*/y" },
    { parser: lexeme(str("a")), text: "a x" },
    { parser: symbol("a"), text: "a x" },
    { parser: keyword("if"), text: "if x" },
    { parser: lexer.parens(lexer.lexeme(int())), text: "(1)" },
  ];

  for (const { parser, text } of cases) {
    for (let index = 0; index <= text.length; index++) {
      const res = parser({ text, index });
      assertEquals(res.ctx.text, text);
      expect(res.ctx.index).toBeGreaterThanOrEqual(index);
      expect(res.ctx.index).toBeLessThanOrEqual(text.length);
    }
  }
});

test("unicode regexes never match before the parser cursor", () => {
  const text = "😀";
  const res = regex(/./u, "code point")({ text, index: 1 });
  assertEquals(res.success, false);
  assertEquals(res.ctx.index, 1);

  const composed = seq(
    anyChar(),
    regex(/./u, "code point"),
  )({
    text,
    index: 0,
  });
  assertEquals(composed.success, false);
  expect(composed.ctx.index).toBeLessThanOrEqual(text.length);
});

test("regex parsers are reusable without mutating the source regexp", () => {
  const source = /a/giu;
  source.lastIndex = 99;
  const parser = regex(source, "a");

  const first = parser({ text: "bA", index: 1 });
  parser({ text: "xx", index: 0 });
  const repeated = parser({ text: "bA", index: 1 });

  assertEquals(first, repeated);
  assertObjectMatch(first, { success: true, value: "A", ctx: { index: 2 } });
  assertEquals(source.lastIndex, 99);
  assertEquals(source.flags, "giu");
});

test("trie matches the same maximal prefixes as exhaustive string parsing", () => {
  const candidateSets = [
    [""],
    ["", "a"],
    ["a", "ab"],
    ["😀", "😀x"],
    ["ab", "a", "ab"],
  ];
  const texts = ["", "x", "ab", "😀x!"];

  for (const candidates of candidateSets) {
    const trieParser = trie(candidates);
    const exhaustive = furthest(
      ...candidates.map((candidate) => str(candidate)),
    );
    for (const text of texts) {
      for (let index = 0; index <= text.length; index++) {
        const actual = trieParser({ text, index });
        const expected = exhaustive({ text, index });
        assertEquals(actual.success, expected.success);
        if (actual.success && expected.success) {
          assertEquals(actual.value, expected.value);
          assertEquals(actual.ctx, expected.ctx);
        }
      }
    }
  }
});

test("trie snapshots candidates and reports an empty candidate set clearly", () => {
  const candidates = ["a"];
  const parser = trie(candidates);
  candidates[0] = "long";

  assertObjectMatch(parser({ text: "a", index: 0 }), {
    success: true,
    value: "a",
  });
  assertObjectMatch(parser({ text: "long", index: 0 }), {
    success: false,
    expected: "one of a",
  });
  assertObjectMatch(trie([])({ text: "", index: 0 }), {
    success: false,
    expected: "trie: expected at least one match",
  });
});

test("numeric parsers reject unsafe integers and non-finite decimals", () => {
  const unsafeInteger = "9007199254740993";
  const overflowingInteger = "9".repeat(309);
  const overflowingDouble = `${overflowingInteger}.0`;

  assertEquals(int()({ text: unsafeInteger, index: 0 }).success, false);
  assertEquals(int()({ text: overflowingInteger, index: 0 }).success, false);
  assertEquals(double()({ text: overflowingDouble, index: 0 }).success, false);
  assertEquals(
    signed()({ text: `-${overflowingInteger}`, index: 0 }).success,
    false,
  );
});

test("hex rejects lowercase and uppercase prefixes", () => {
  for (const text of ["0xFF", "0XFF"]) {
    const res = hex()({ text, index: 0 });
    assertEquals(res.success, false);
    assertEquals(res.ctx.index, 0);
  }
});

test("runParser rejects invalid UTF-16 start offsets", () => {
  const cases = [
    { index: -1, validIndex: 0 },
    { index: 0.5, validIndex: 0 },
    { index: 2, validIndex: 1 },
    { index: Number.NaN, validIndex: 0 },
    { index: Number.POSITIVE_INFINITY, validIndex: 0 },
    { index: Number.NEGATIVE_INFINITY, validIndex: 0 },
    { index: Number.MAX_SAFE_INTEGER + 1, validIndex: 1 },
  ];

  for (const { index, validIndex } of cases) {
    const res = runParser(takeText(), "a", index);
    assertEquals(res.success, false);
    if (!res.success) {
      assertEquals(
        res.expected,
        "runParser: index must be a safe integer within the input",
      );
      assertEquals(res.ctx, { text: "a", index: validIndex });
      assertEquals(res.location, { line: 1, column: validIndex + 1 });
    }
  }
});

test("character parsers reject invalid UTF-16 codes", () => {
  for (const code of [-1, 0.5, 0x10000, Number.NaN]) {
    assertEquals(char(code)({ text: "\0", index: 0 }).success, false);
    assertEquals(notChar(code)({ text: "\0", index: 0 }).success, false);
  }
});

test("comment trivia keeps delimiters and fatal termination behavior", () => {
  assertObjectMatch(lineComment()({ text: "//x\nY", index: 0 }), {
    success: true,
    value: null,
    ctx: { index: 3 },
  });
  assertObjectMatch(blockComment()({ text: "/*a*/b*/", index: 0 }), {
    success: true,
    value: null,
    ctx: { index: 5 },
  });

  for (const { parser, text } of [
    { parser: defaultTrivia(), text: " \t/*x" },
    { parser: lexeme(str("a")), text: "a \t/*x" },
  ]) {
    const res = parser({ text, index: 0 });
    assertEquals(res.success, false);
    if (!res.success) {
      assertEquals(res.fatal, true);
      assertEquals(res.expected, "*/");
      assertEquals(res.ctx.index, text.length);
    }
  }
});
