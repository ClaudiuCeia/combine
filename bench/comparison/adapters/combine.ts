import {
  chainl1,
  digit,
  either,
  eof,
  lazy,
  many1,
  map,
  optional,
  type Parser,
  seq,
  space,
  str,
  surrounded,
} from "../../../mod.ts";
import { type BenchmarkAdapter, parseFailure } from "../types.ts";

const createExpressionParser = (): Parser<number> => {
  const whitespace = optional(space());
  const lexeme = <T>(parser: Parser<T>): Parser<T> =>
    map(seq(parser, whitespace), ([value]) => value);
  const symbol = (value: string): Parser<string> => lexeme(str(value));
  const integer = map(lexeme(many1(digit())), (digits) =>
    digits.reduce((value, next) => value * 10 + next, 0),
  );

  const grammar: { expression?: Parser<number> } = {};
  const expressionRef = lazy(() => grammar.expression!);
  const factor: Parser<number> = either(
    integer,
    surrounded(symbol("("), expressionRef, symbol(")")),
  );
  const product = chainl1(
    factor,
    either(symbol("*"), symbol("/")),
    (left, operator, right) => (operator === "*" ? left * right : left / right),
  );
  grammar.expression = chainl1(
    product,
    either(symbol("+"), symbol("-")),
    (left, operator, right) => (operator === "+" ? left + right : left - right),
  );

  return map(
    seq(whitespace, grammar.expression, eof()),
    ([, output]) => output,
  );
};

export const createCombineAdapter = (): BenchmarkAdapter => {
  const expression = createExpressionParser();

  return {
    name: "combine",
    parseExpression: (input) => {
      const result = expression({ text: input, index: 0 });
      return result.success ? result.value : parseFailure;
    },
  };
};
