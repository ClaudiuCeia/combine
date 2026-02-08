import {
  any,
  createLanguageThis,
  createLexer,
  eof,
  many,
  map,
  number,
  regex,
  seq,
} from "../mod.ts";
import P from "parsimmon";

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

const lx = createLexer();
const sym = lx.lexeme(regex(/[a-zA-Z_-][a-zA-Z0-9_-]*/, "symbol"));
const num = lx.lexeme(number());

const combineLisp = createLanguageThis({
  Expression() {
    return any(this.List, this.Number, this.Symbol);
  },
  Symbol() {
    return sym;
  },
  Number() {
    return num;
  },
  List() {
    return lx.parens(many(this.Expression));
  },
  File() {
    return map(seq(lx.trivia, many(this.Expression), eof()), ([, xs]) => xs);
  },
});

const ParsimmonLisp = P.createLanguage({
  // deno-lint-ignore no-explicit-any
  Expression: (r: any) => {
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
  // deno-lint-ignore no-explicit-any
  List: (r: any) => {
    return r.Expression.trim(P.optWhitespace)
      .many()
      .wrap(P.string("("), P.string(")"));
  },
  // deno-lint-ignore no-explicit-any
  File: function (r: any) {
    return r.Expression.trim(P.optWhitespace).many();
  },
});

Deno.bench("combine", { group: "lisp" }, () => {
  combineLisp.File({ text, index: 0 });
});

Deno.bench("parsimmon", { group: "lisp", baseline: true }, () => {
  ParsimmonLisp.File.tryParse(text);
});
