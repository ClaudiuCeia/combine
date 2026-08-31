import {
  any as choice,
  eof,
  intP,
  lazy,
  map,
  oneOrManyRed,
  type Parser,
  seq,
  str,
  wspaces,
} from "parser-combinators";
import { type BenchmarkAdapter, parseFailure } from "../types.ts";

const createExpressionParser = (): Parser<number> => {
  const lexeme = <T>(parser: Parser<T>): Parser<T> =>
    map(seq(parser, wspaces), ([value]) => value);
  const symbol = (value: string): Parser<string> => lexeme(str(value));
  const integer = lexeme(intP);

  const grammar: { expression?: Parser<number> } = {};
  const expressionRef = lazy(() => grammar.expression!);
  const factor: Parser<number> = choice(
    integer,
    map(
      seq(symbol("("), expressionRef, symbol(")")),
      ([, value]) => value,
    ),
  );
  const product = oneOrManyRed(
    factor,
    choice(symbol("*"), symbol("/")),
    (left, right, operator) => operator === "*" ? left * right : left / right,
  );
  grammar.expression = oneOrManyRed(
    product,
    choice(symbol("+"), symbol("-")),
    (left, right, operator) => operator === "+" ? left + right : left - right,
  );

  return map(
    seq(wspaces, grammar.expression, eof),
    ([, output]) => output,
  );
};

const run = <T>(parser: Parser<T>, input: string): T | typeof parseFailure => {
  const result = parser({ text: input, path: "", index: 0 });
  return result.success ? result.value : parseFailure;
};

export const createParserCombinatorsAdapter = (): BenchmarkAdapter => {
  const expression = createExpressionParser();

  return {
    name: "parser-combinators",
    parseExpression: (input) => run(expression, input),
  };
};
