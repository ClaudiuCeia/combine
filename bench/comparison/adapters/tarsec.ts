import {
  digit,
  eof,
  lazy,
  many,
  many1,
  map,
  or,
  type Parser,
  seq,
  seqR,
  space,
  str,
} from "tarsec";
import { type BenchmarkAdapter, parseFailure } from "../types.ts";

const createExpressionParser = (): Parser<number> => {
  const whitespace = many(space);
  const lexeme = <T>(parser: Parser<T>): Parser<T> =>
    map(seqR(parser, whitespace), (parts) => parts[0] as T);
  const symbol = (value: string): Parser<string> => lexeme(str(value));
  const integer = map(lexeme(many1(digit)), (digits) =>
    Number(digits.join("")),
  );

  const grammar: { expression?: Parser<number> } = {};
  const expressionRef = lazy(() => grammar.expression!);
  const factor = or(
    integer,
    seq(
      [symbol("("), expressionRef, symbol(")")],
      (parts) => parts[1] as number,
    ),
  );
  const productTail = map(
    seqR(or(symbol("*"), symbol("/")), factor),
    (parts) => [parts[0] as string, parts[1] as number] as const,
  );
  const product = map(seqR(factor, many(productTail)), (parts) =>
    (parts[1] as (readonly [string, number])[]).reduce(
      (left, [operator, right]) =>
        operator === "*" ? left * right : left / right,
      parts[0] as number,
    ),
  );
  const sumTail = map(
    seqR(or(symbol("+"), symbol("-")), product),
    (parts) => [parts[0] as string, parts[1] as number] as const,
  );
  grammar.expression = map(seqR(product, many(sumTail)), (parts) =>
    (parts[1] as (readonly [string, number])[]).reduce(
      (left, [operator, right]) =>
        operator === "+" ? left + right : left - right,
      parts[0] as number,
    ),
  );

  return seq(
    [whitespace, grammar.expression, eof],
    (parts) => parts[1] as number,
  );
};

const run = <T>(parser: Parser<T>, input: string): T | typeof parseFailure => {
  const result = parser(input);
  return result.success ? result.result : parseFailure;
};

export const createTarsecAdapter = (): BenchmarkAdapter => {
  const expression = createExpressionParser();

  return {
    name: "tarsec",
    parseExpression: (input) => run(expression, input),
  };
};
