import {
  digit,
  eof,
  type Parjser,
  ResultKind,
  string,
  whitespace,
} from "parjs";
import {
  between,
  later,
  many,
  many1,
  map,
  or,
  qthen,
  then,
  thenq,
} from "parjs/combinators";
import { type BenchmarkAdapter, parseFailure } from "../types.ts";

const createExpressionParser = (): Parjser<number> => {
  const spacing = whitespace();
  const lexeme = <T>(parser: Parjser<T>): Parjser<T> =>
    parser.pipe(thenq(spacing));
  const symbol = (value: string): Parjser<string> => lexeme(string(value));
  const integer = lexeme(
    digit().pipe(
      many1(),
      map((digits) => Number(digits.join(""))),
    ),
  );

  const expression = later<number>();
  const factor = integer.pipe(
    or(expression.pipe(between(symbol("("), symbol(")")))),
  );
  const product = factor.pipe(
    then(
      symbol("*")
        .pipe(or(symbol("/")), then(factor))
        .pipe(many()),
    ),
    map(([head, tail]) =>
      tail.reduce(
        (left, [operator, right]) =>
          operator === "*" ? left * right : left / right,
        head,
      ),
    ),
  );
  const sum = product.pipe(
    then(
      symbol("+")
        .pipe(or(symbol("-")), then(product))
        .pipe(many()),
    ),
    map(([head, tail]) =>
      tail.reduce(
        (left, [operator, right]) =>
          operator === "+" ? left + right : left - right,
        head,
      ),
    ),
  );
  expression.init(sum);

  return spacing.pipe(qthen(expression), thenq(eof()));
};

export const createParjsAdapter = (): BenchmarkAdapter => {
  const expression = createExpressionParser();

  return {
    name: "parjs",
    parseExpression: (input) => {
      const result = expression.parse(input);
      return result.kind === ResultKind.Ok ? result.value : parseFailure;
    },
  };
};
