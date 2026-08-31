import { bench, group, run, summary } from "mitata";
import {
  any,
  chainl1,
  defineLanguage,
  eof,
  lazy,
  map,
  number,
  type Parser,
  seq,
  str,
  surrounded,
} from "../mod.ts";

const text = `2+2*3+2/4-1+2+2*3+(2/(4-1+2+2*3+2/4-1+2+2*3+2/4-1+2+2*3+2/4-1+2+2)*3+2/4-1+2+2*3+2/4-1`;

const combineMul = (left: number, op: string, right: number): number => {
  switch (op) {
    case "*":
      return left * right;
    case "/":
      return left / right;
    default:
      return left;
  }
};

const combineAdd = (left: number, op: string, right: number): number => {
  switch (op) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    default:
      return left;
  }
};

type CalcGrammar = Readonly<{
  AddOp: string;
  MulOp: string;
  Factor: number;
  Term: number;
  Expression: number;
  File: number;
}>;

group("calculator", () => {
  summary(() => {
    bench("defineLanguage", () => {
      const C = defineLanguage<CalcGrammar>({
        AddOp: () => any(str("+"), str("-")),
        MulOp: () => any(str("*"), str("/")),
        Factor: ({ Expression }) =>
          any(surrounded(str("("), Expression, str(")")), number()),
        Term: ({ Factor, MulOp }) => chainl1(Factor, MulOp, combineMul),
        Expression: ({ Term, AddOp }) => chainl1(Term, AddOp, combineAdd),
        File: ({ Expression }) => map(seq(Expression, eof()), ([v]) => v),
      });

      C.File({ text, index: 0 });
    });

    bench("raw", () => {
      const AddOp = any(str("+"), str("-"));
      const MulOp = any(str("*"), str("/"));

      const Expression: Parser<number> = chainl1(
        lazy(() => Term),
        AddOp,
        combineAdd,
      );

      const Factor: Parser<number> = any(
        surrounded(
          str("("),
          lazy(() => Expression),
          str(")"),
        ),
        number(),
      );

      const Term: Parser<number> = chainl1(Factor, MulOp, combineMul);

      const File = map(seq(Expression, eof()), ([v]) => v);
      File({ text, index: 0 });
    }).baseline();
  });
});

await run({ throw: true });
