import {
  assertEquals,
  assertObjectMatch,
} from "https://deno.land/std@0.120.0/testing/asserts.ts";
import {
  any,
  many,
  surrounded,
  seq,
  optional,
} from "../src/combinators.ts";
import { eof, number, regex, str, space } from "../src/parsers.ts";
import { createLanguage, map } from "../src/utility.ts";

Deno.test("create language", () => {
  const L = createLanguage({
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
