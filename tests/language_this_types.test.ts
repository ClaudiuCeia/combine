// More type-level coverage for createLanguageThis.

import type { Parser } from "../src/Parser.ts";
import { createLanguageThis } from "../src/language.ts";
import { number, str } from "../src/parsers.ts";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true
  : false;
type Assert<T extends true> = T;

Deno.test("createLanguageThis preserves return types on the bound language", () => {
  const L = createLanguageThis({
    Foo(): Parser<string> {
      return str("foo");
    },
    Num(): Parser<number> {
      return number();
    },
  });

  // Compile-time assertions.
  type _ = Assert<Equal<typeof L.Foo, Parser<string>>>;
  type __ = Assert<Equal<typeof L.Num, Parser<number>>>;

  // Assignability checks.
  const ok: Parser<string> = L.Foo;
  void ok;

  // @ts-expect-error - wrong result type
  const bad: Parser<boolean> = L.Foo;
  void bad;
});
