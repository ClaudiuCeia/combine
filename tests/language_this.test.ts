import { assertEquals, assertObjectMatch } from "@std/assert";
import { any, many, optional, seq, surrounded } from "../src/combinators.ts";
import { eof, number, regex, space, str } from "../src/parsers.ts";
import { map } from "../src/utility.ts";
import { createLanguageThis } from "../src/language.ts";

Deno.test("createLanguageThis runtime behavior matches createLanguage", () => {
  const L = createLanguageThis({
    Expression() {
      return map(
        seq(any(this.Symbol, this.Number, this.List), optional(space())),
        ([first]) => first,
      );
    },
    Symbol() {
      return regex(/[a-zA-Z_-][a-zA-Z0-9_-]*/, "symbol");
    },
    Number() {
      return number();
    },
    List() {
      return surrounded(str("("), many(this.Expression), str(")"));
    },
    File() {
      return map(
        seq(optional(space()), many(this.Expression), eof()),
        ([, mid]) => mid,
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
