import {
  any,
  chainl1,
  createLanguage,
  createLanguageThis,
  eof,
  lazy,
  map,
  number,
  type Parser,
  seq,
  str,
  surrounded,
} from "../mod.ts";

const text =
  `2+2*3+2/4-1+2+2*3+(2/(4-1+2+2*3+2/4-1+2+2*3+2/4-1+2+2*3+2/4-1+2+2)*3+2/4-1+2+2*3+2/4-1`;

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

type CalcLang = Readonly<{
  AddOp: Parser<string>;
  MulOp: Parser<string>;
  Factor: Parser<number>;
  Term: Parser<number>;
  Expression: Parser<number>;
  File: Parser<number>;
}>;

Deno.bench("createLanguage", { group: "calculator" }, () => {
  const C = createLanguage<CalcLang>({
    AddOp: () => any(str("+"), str("-")),
    MulOp: () => any(str("*"), str("/")),
    Factor: (s) => any(surrounded(str("("), s.Expression, str(")")), number()),
    Term: (s) => chainl1(s.Factor, s.MulOp, combineMul),
    Expression: (s) => chainl1(s.Term, s.AddOp, combineAdd),
    File: (s) => map(seq(s.Expression, eof()), ([v]) => v),
  });

  C.File({ text, index: 0 });
});

Deno.bench("createLanguageThis", { group: "calculator" }, () => {
  const C = createLanguageThis({
    AddOp() {
      return any(str("+"), str("-"));
    },
    MulOp() {
      return any(str("*"), str("/"));
    },
    Factor() {
      return any(surrounded(str("("), this.Expression, str(")")), number());
    },
    Term() {
      return chainl1(this.Factor, this.MulOp, combineMul);
    },
    Expression() {
      return chainl1(this.Term, this.AddOp, combineAdd);
    },
    File() {
      return map(seq(this.Expression, eof()), ([v]) => v);
    },
  }) as unknown as CalcLang;

  C.File({ text, index: 0 });
});

Deno.bench("raw", { group: "calculator", baseline: true }, () => {
  const AddOp = any(str("+"), str("-"));
  const MulOp = any(str("*"), str("/"));

  const Expression: Parser<number> = chainl1(
    lazy(() => Term),
    AddOp,
    combineAdd,
  );

  const Factor: Parser<number> = any(
    surrounded(str("("), lazy(() => Expression), str(")")),
    number(),
  );

  const Term: Parser<number> = chainl1(Factor, MulOp, combineMul);

  const File = map(seq(Expression, eof()), ([v]) => v);
  File({ text, index: 0 });
});
