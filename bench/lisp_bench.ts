import { any, many, seq } from "../src/combinators.ts";
import { regex, str, eof, space } from "../src/parsers.ts";
import * as P from "https://esm.sh/parsimmon@1.18.1";
import { UntypedLanguage, createLanguage } from "../src/language.ts";

const text = `
    (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list)))
    (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list)))
    (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) 
    (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list)))(list 1 2 (cons 1 (list)))
    (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list)))
    (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list)))
    (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) 
    (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list))) (list 1 2 (cons 1 (list)))(list 1 2 (cons 1 (list)))
`;

const combineLisp = createLanguage<UntypedLanguage>({
  Expression: (s) => {
    return any(s.Symbol, s.Number, s.List);
  },
  Symbol: () => {
    return seq(regex(/[a-zA-Z_-][a-zA-Z0-9_-]*/, "symbol"), space());
  },
  Number: () => {
    return seq(regex(/[0-9]+/, "number"), space());
  },
  List: (s) => {
    return seq(str("("), many(s.Expression), str(")"), space());
  },
  File: (s) => {
    return seq(space(), many(s.Expression), eof());
  },
});

const ParsimmonLisp = P.createLanguage({
  Expression: (r) => {
    return P.alt(r.Symbol, r.Number, r.List);
  },
  Symbol: () => {
    return P.regexp(/[a-zA-Z_-][a-zA-Z0-9_-]*/).desc("symbol");
  },
  Number: () => {
    return P.regexp(/[0-9]+/)
      .map(Number)
      .desc("number");
  },
  List: (r) => {
    return r.Expression.trim(P.optWhitespace)
      .many()
      .wrap(P.string("("), P.string(")"));
  },
  File: function (r) {
    return r.Expression.trim(P.optWhitespace).many();
  },
});

Deno.bench("combine", { group: "lisp" }, () => {
  combineLisp.File({ text, index: 0 });
});

Deno.bench("parsimmon", { group: "lisp", baseline: true }, () => {
  ParsimmonLisp.File.tryParse(text);
});
