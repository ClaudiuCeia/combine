import { any, many, seq } from "../src/combinators.ts";
import { regex, str, eof, space } from "../src/parsers.ts";
import { createLanguage } from "../src/utility.ts";
import * as P from "https://esm.sh/parsimmon@1.18.1";

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

const combineLisp = createLanguage({
  Expression: (s) => {
    return seq(any(s.Symbol, s.Number, s.List), space());
  },
  Symbol: () => {
    return regex(/[a-zA-Z_-][a-zA-Z0-9_-]*/, "symbol");
  },
  Number: () => {
    return regex(/[0-9]+/, "number");
  },
  List: (s) => {
    return seq(str("("), many(s.Expression), str(")"));
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

Deno.bench("combine lisp", { group: "timing" }, () => {
  combineLisp.File({ text, index: 0 });
});

Deno.bench("parsimmon lisp", { group: "timing", baseline: true }, () => {
  ParsimmonLisp.File.tryParse(text);
});
