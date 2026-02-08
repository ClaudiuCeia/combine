// Type-level tests for createLanguage inference.
// Deno runs type-checking on tests, so `@ts-expect-error` assertions work here.

import { createLanguageThis } from "../src/language.ts";
import type { Parser } from "../src/Parser.ts";
import { any, many, optional, seq, surrounded } from "../src/combinators.ts";
import { eof, number, regex, space, str } from "../src/parsers.ts";
import { map } from "../src/utility.ts";

Deno.test("createLanguageThis infers keys and this without explicit type argument", () => {
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

  const _p: Parser<unknown> = L.Expression;
  void _p;

  // @ts-expect-error - does not exist
  // deno-lint-ignore no-explicit-any
  const _missing: any = L.DoesNotExist;
  void _missing;
});
