import {
  any,
  createLexer,
  defineLanguage,
  eof,
  formatErrorReport,
  many,
  map,
  number,
  regex,
  seq,
} from "../mod.ts";

const lx = createLexer();
const symbol = lx.lexeme(regex(/[a-zA-Z_-][a-zA-Z0-9_-]*/, "symbol"));
const numberLit = lx.lexeme(number());

type Expression = string | number | Expression[];
type Grammar = {
  Expression: Expression;
  Symbol: string;
  Number: number;
  List: Expression[];
  File: Expression[];
};

const L = defineLanguage<Grammar>({
  Expression: ({ List, Number, Symbol }) => any(List, Number, Symbol),
  Symbol: () => symbol,
  Number: () => numberLit,
  List: ({ Expression }) => {
    // `lexeme(...)` eats trailing trivia so list elements can be separated by
    // whitespace/comments without handling it in every production.
    return lx.parens(many(Expression));
  },
  File: ({ Expression }) => {
    return map(seq(lx.trivia, many(Expression), eof()), ([, exprs]) => exprs);
  },
});

const text = `
  (list 1 2 (cons 1 (list)))
  (print 5 golden rings)`;

const res = L.File({ text, index: 0 });
if (res.success) {
  console.log(JSON.stringify(res.value, undefined, 2));
} else {
  console.error(formatErrorReport(res, { color: true }));
}
