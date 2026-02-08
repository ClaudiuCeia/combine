import { assertEquals } from "@std/assert";
import {
  createLexer,
  defaultTrivia,
  keyword,
  lexeme,
  symbol,
} from "../src/lexer.ts";
import { eof, int, str } from "../src/parsers.ts";
import { seq } from "../src/combinators.ts";
import { map } from "../src/utility.ts";

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
