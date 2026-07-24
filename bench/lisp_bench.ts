import {
  any,
  createLexer,
  defineLanguage,
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

type Expression = string | number | Expression[];
type LispGrammar = {
  Expression: Expression;
  Symbol: string;
  Number: number;
  List: Expression[];
  File: Expression[];
};

const combineLisp = defineLanguage<LispGrammar>({
  Expression: ({ List, Number, Symbol }) => any(List, Number, Symbol),
  Symbol: () => sym,
  Number: () => num,
  List: ({ Expression }) => lx.parens(many(Expression)),
  File: ({ Expression }) =>
    map(seq(lx.trivia, many(Expression), eof()), ([, xs]) => xs),
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
