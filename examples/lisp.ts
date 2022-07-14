import { any, surrounded, many, seq, optional } from "../src/combinators.ts";
import { regex, number, str, eof, space } from "../src/parsers.ts";
import { createLanguage, map } from "../src/utility.ts";

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

export const res = L.File({ text, index: 0 });
