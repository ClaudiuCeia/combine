import { assertEquals } from "@std/assert";
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

Deno.test("symbol and keyword preserve literal result types", () => {
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

Deno.test("lexeme consumes trailing whitespace", () => {
  const p = seq(lexeme(str("a")), str("b"), eof());
  const res = p({ text: "a   b", index: 0 });
  assertEquals(res.success, true);
});

Deno.test("defaultTrivia consumes line and block comments", () => {
  const p = seq(
    symbol("a", defaultTrivia()),
    symbol("b", defaultTrivia()),
    eof(),
  );
  const res = p({ text: "a // hi\n /* ok */ b", index: 0 });
  assertEquals(res.success, true);
});

Deno.test("blockComment consumes empty and multiline comments", () => {
  for (const text of ["/**/", "/* first\nsecond */"]) {
    const res = blockComment()({ text, index: 0 });
    assertEquals(res.success, true);
    if (res.success) {
      assertEquals(res.value, null);
      assertEquals(res.ctx.index, text.length);
    }
  }
});

Deno.test("defaultTrivia commits unterminated block comments", () => {
  const text = "/* no closing delimiter";
  const res = seq(defaultTrivia(), eof())({ text, index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.fatal, true);
    assertEquals(res.expected, "*/");
    assertEquals(res.ctx.index, text.length);
  }
});

Deno.test("keyword enforces identifier boundary", () => {
  const p = seq(keyword("if"), eof());
  assertEquals(p({ text: "if", index: 0 }).success, true);
  assertEquals(p({ text: "ifx", index: 0 }).success, false);
});

Deno.test("createLexer provides a consistent trivia policy", () => {
  const L = createLexer();
  const p = map(
    seq(L.symbol("("), L.lexeme(int()), L.symbol(")"), eof()),
    ([, n]) => n,
  );
  const res = p({ text: "(  12 /*x*/ )", index: 0 });
  assertEquals(res.success, true);
  if (res.success) assertEquals(res.value, 12);
});
