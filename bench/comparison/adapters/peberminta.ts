import * as p from "peberminta";
import * as pc from "peberminta/char";
import { type BenchmarkAdapter, parseFailure } from "../types.ts";

type P<T> = p.Parser<string, unknown, T>;

const createExpressionParser = (): P<number> => {
  const whitespace = p.many(pc.anyOf([" ", "\t", "\r", "\n"]));
  const lexeme = <T>(parser: P<T>): P<T> => p.left(parser, whitespace);
  const symbol = (value: string): P<string> => lexeme(pc.str(value));
  const digit = pc.anyOf("0123456789".split(""));
  const integer = lexeme(
    p.map(p.many1(digit), (digits) => Number(digits.join(""))),
  );

  const grammar: { expression?: P<number> } = {};
  const expressionRef = p.recursive(() => grammar.expression!);
  const factor: P<number> = p.choice(
    integer,
    p.middle(symbol("("), expressionRef, symbol(")")),
  );
  const multiply = p.map(
    p.choice(symbol("*"), symbol("/")),
    (operator) =>
      operator === "*"
        ? (left: number, right: number) => left * right
        : (left: number, right: number) => left / right,
  );
  const product = p.leftAssoc2(factor, multiply, factor);
  const add = p.map(
    p.choice(symbol("+"), symbol("-")),
    (operator) =>
      operator === "+"
        ? (left: number, right: number) => left + right
        : (left: number, right: number) => left - right,
  );
  grammar.expression = p.leftAssoc2(product, add, product);

  return p.middle(whitespace, grammar.expression, p.eof<string, unknown>);
};

const run = <T>(parser: P<T>, input: string): T | typeof parseFailure => {
  const result = parser({ tokens: [...input], options: undefined }, 0);
  return result.matched ? result.value : parseFailure;
};

export const createPebermintaAdapter = (): BenchmarkAdapter => {
  const expression = createExpressionParser();

  return {
    name: "peberminta",
    parseExpression: (input) => run(expression, input),
  };
};
