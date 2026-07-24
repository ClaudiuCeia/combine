import {
  any,
  chainl1,
  createLexer,
  defineLanguage,
  eof,
  formatErrorReport,
  map,
  mark,
  number,
  seq,
} from "../mod.ts";

type Expr =
  | Readonly<{ kind: "num"; value: number; start: number; end: number }>
  | Readonly<{
    kind: "bin";
    op: "+" | "-" | "*" | "/";
    left: Expr;
    right: Expr;
    start: number;
    end: number;
  }>;

const lx = createLexer();

const Num: ReturnType<typeof number> = number();
const NumExpr = map(mark(lx.lexeme(Num)), ({ value, startIndex, endIndex }) => {
  return { kind: "num", value, start: startIndex, end: endIndex } as const;
});

type Grammar = {
  Factor: Expr;
  Term: Expr;
  Expression: Expr;
  File: Expr;
};

const Calc = defineLanguage<Grammar>({
  Factor: ({ Expression }) => {
    const paren = map(
      mark(seq(lx.symbol("("), Expression, lx.symbol(")"))),
      ({ value: [, expr], startIndex, endIndex }) => {
        // Extend the inner expression span to include the parentheses.
        return { ...expr, start: startIndex, end: endIndex };
      },
    );
    return any(paren, NumExpr);
  },
  Term: ({ Factor }) => {
    const op = any(lx.symbol("*"), lx.symbol("/"));
    return chainl1(Factor, op, (left, op, right) => {
      const bop = op as "*" | "/";
      return {
        kind: "bin",
        op: bop,
        left,
        right,
        start: left.start,
        end: right.end,
      };
    });
  },
  Expression: ({ Term }) => {
    const op = any(lx.symbol("+"), lx.symbol("-"));
    return chainl1(Term, op, (left, op, right) => {
      const bop = op as "+" | "-";
      return {
        kind: "bin",
        op: bop,
        left,
        right,
        start: left.start,
        end: right.end,
      };
    });
  },
  File: ({ Expression }) =>
    map(seq(lx.trivia, Expression, eof()), ([, expr]) => expr),
});

const ok = `1 + 2*3 + (4 - 5) / 6`;
const bad = `1 + * 2`;

for (const text of [ok, bad]) {
  const res = Calc.File({ text, index: 0 });
  if (res.success) {
    console.log("ok:", {
      span: [res.value.start, res.value.end],
      astBytes: JSON.stringify(res.value).length,
    });
  } else {
    console.log(formatErrorReport(res, { color: true, contextLines: 1 }));
  }
}
