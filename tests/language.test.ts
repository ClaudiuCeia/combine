import {
  assertEquals,
  assertObjectMatch,
} from "https://deno.land/std@0.149.0/testing/asserts.ts";
import { any, many, surrounded, seq, optional } from "../src/combinators.ts";
import { eof, number, regex, str, space } from "../src/parsers.ts";
import { map } from "../src/utility.ts";
import {
  createLanguage,
} from "../src/language.ts";
import { Parser } from "../src/Parser.ts";

type SymbolNode = string;
type NumberNode = number;
type ExpressionNode = string | number | ListNode;
type ListNode = ExpressionNode[];
type FileNode = ExpressionNode[];

type LanguageDefinition = {
  Expression: Parser<ExpressionNode>;
  Symbol: Parser<SymbolNode>;
  Number: Parser<NumberNode>;
  List: Parser<ListNode>;
  File: Parser<FileNode>;
};

Deno.test("create language", () => {
  const L = createLanguage<LanguageDefinition>({
    Expression: (s) => {
      return map(
        seq(any(s.Symbol, s.Number, s.List), optional(space())),
        ([first]) => first
      );
    },
    Symbol: () => {
      return regex(/[a-zA-Z_-][a-zA-Z0-9_-]*/, "symbol");
    },
    Number: number,
    List: (s) => {
      return surrounded(str("("), many(s.Expression), str(")"));
    },
    File: (s) => {
      return map(
        seq(optional(space()), many(s.Expression), eof()),
        ([, mid]) => mid
      );
    },
  });

  const text = `
    (list 1 2 (cons 1 (list)))
    (print 5 golden rings)
  `;

  const res = L.File({ text, index: 0 });
  assertObjectMatch(res, {
    success: true,
    ctx: {
      text,
      index: text.length,
    },
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      ["list", 1, 2, ["cons", 1, ["list"]]],
      ["print", 5, "golden", "rings"],
    ]);
  }
});
