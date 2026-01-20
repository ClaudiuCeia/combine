import { any, many, seq, seqNonNull, skip1 } from "../src/combinators.ts";
import { eof, regex, space, str } from "../src/parsers.ts";
import { createLanguage } from "../src/language.ts";
import type { Parser } from "../src/Parser.ts";

type LispLang = {
  Number: Parser<string[]>;
  Symbol: Parser<string[]>;
  Expression: Parser<unknown>;
  List: Parser<unknown[]>;
  File: Parser<unknown>;
};

const L = createLanguage<LispLang>({
  Expression: (s) => {
    return any(s.Symbol, s.Number, s.List);
  },
  Symbol: () => {
    return seqNonNull(
      regex(/[a-zA-Z_-][a-zA-Z0-9_-]*/, "symbol"),
      skip1(space()),
    );
  },
  Number: () => {
    return seqNonNull(regex(/[0-9]+/, "number"), skip1(space()));
  },
  List: (s) => {
    return seqNonNull<unknown>(
      str("("),
      many(s.Expression),
      str(")"),
      skip1(space()),
    );
  },
  File: (s) => {
    return seq(space(), many(s.Expression), eof());
  },
});

const text = `
  (list 1 2 (cons 1 (list)))
  (print 5 golden rings)`;

console.log(JSON.stringify(L.File({ text, index: 0 }), undefined, 2));
