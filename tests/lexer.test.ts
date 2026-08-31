import { assertEquals } from "./assert.ts";
import { test } from "bun:test";
import {
  blockComment,
  createLexer,
  defaultTrivia,
  keyword,
  lexeme,
  symbol,
} from "../src/lexer.ts";
import { eof, int, str } from "../src/parsers.ts";
import { seq } from "../src/combinators.ts";
import { map } from "../src/utility.ts";
import type { Parser } from "../src/Parser.ts";

test("symbol and keyword preserve literal result types", () => {
  const symbolParser: Parser<"("> = symbol("(");
  const keywordParser: Parser<"if"> = keyword("if");
  const lexer = createLexer();
  const lexerSymbol: Parser<")"> = lexer.symbol(")");
  const lexerKeyword: Parser<"else"> = lexer.keyword("else");

  assertEquals(symbolParser({ text: "(", index: 0 }).success, true);
  assertEquals(keywordParser({ text: "if", index: 0 }).success, true);
  assertEquals(lexerSymbol({ text: ")", index: 0 }).success, true);
  assertEquals(lexerKeyword({ text: "else", index: 0 }).success, true);
});

test("lexeme consumes trailing whitespace", () => {
  const p = seq(lexeme(str("a")), str("b"), eof());
  const res = p({ text: "a   b", index: 0 });
  assertEquals(res.success, true);
});

test("defaultTrivia consumes line and block comments", () => {
  const p = seq(
    symbol("a", defaultTrivia()),
    symbol("b", defaultTrivia()),
    eof(),
  );
  const res = p({ text: "a // hi\n /* ok */ b", index: 0 });
  assertEquals(res.success, true);
});

test("blockComment consumes empty and multiline comments", () => {
  for (const text of ["/**/", "/* first\nsecond */"]) {
    const res = blockComment()({ text, index: 0 });
    assertEquals(res.success, true);
    if (res.success) {
      assertEquals(res.value, null);
      assertEquals(res.ctx.index, text.length);
    }
  }
});

test("defaultTrivia commits unterminated block comments", () => {
  const text = "/* no closing delimiter";
  const res = seq(defaultTrivia(), eof())({ text, index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.fatal, true);
    assertEquals(res.expected, "*/");
    assertEquals(res.ctx.index, text.length);
  }
});

test("keyword enforces identifier boundary", () => {
  const p = seq(keyword("if"), eof());
  assertEquals(p({ text: "if", index: 0 }).success, true);
  assertEquals(p({ text: "ifx", index: 0 }).success, false);
});

test("createLexer provides a consistent trivia policy", () => {
  const L = createLexer();
  const p = map(
    seq(L.symbol("("), L.lexeme(int()), L.symbol(")"), eof()),
    ([, n]) => n,
  );
  const res = p({ text: "(  12 /*x*/ )", index: 0 });
  assertEquals(res.success, true);
  if (res.success) assertEquals(res.value, 12);
});

test("createLexer parens returns the enclosed value", () => {
  const lexer = createLexer();
  const res = lexer.parens(lexer.lexeme(int()))({
    text: "( 12 /*x*/ )",
    index: 0,
  });

  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, 12);
    assertEquals(res.ctx.index, 12);
  }
});
