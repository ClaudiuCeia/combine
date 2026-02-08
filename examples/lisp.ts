import {
  any,
  createLanguageThis,
  createLexer,
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

const L = createLanguageThis({
  Expression() {
    return any(this.List, this.Number, this.Symbol);
  },
  Symbol() {
    return symbol;
  },
  Number() {
    return numberLit;
  },
  List() {
    // `lexeme(...)` eats trailing trivia so list elements can be separated by
    // whitespace/comments without handling it in every production.
    return lx.parens(many(this.Expression));
  },
  File() {
    return map(
      seq(lx.trivia, many(this.Expression), eof()),
      ([, exprs]) => exprs,
    );
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
