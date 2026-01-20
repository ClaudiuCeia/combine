import { assertObjectMatch } from "@std/assert";
import { any, chainl1, oneOf, surrounded } from "../src/combinators.ts";
import type { Parser } from "../src/Parser.ts";
import { number, str } from "../src/parsers.ts";
import { lazy, map, peekAnd } from "../src/utility.ts";

/**
 * An implementation of a simple calculator using chainl1.
 */
const paren = <T>(parser: Parser<T>): Parser<T> =>
  surrounded(str("("), parser, str(")"));

const addop = any(str("+"), str("-"));
const mulop = any(str("*"), str("/"));

function factor(): Parser<number> {
  return map(
    oneOf(
      peekAnd(
        str("("),
        lazy(() => paren(expression())),
      ),
      number(),
    ),
    (maybeNum) => {
      if (maybeNum === null) {
        throw new Error("Panic at the disco");
      }

      return maybeNum;
    },
  );
}

function term(): Parser<number> {
  return chainl1(factor(), mulop, (left, op, right) => {
    switch (op) {
      case "*":
        return left * right;
      case "/":
        return left / right;
      default:
        throw new Error("Expected multiplication or division");
    }
  });
}

function expression(): Parser<number> {
  return chainl1(term(), addop, (left, op, right) => {
    switch (op) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      default:
        throw new Error("Expected addition or subtraction");
    }
  });
}

const testExpr = (expr: string, value: number): void => {
  assertObjectMatch(expression()({ text: expr, index: 0 }), {
    value,
  });
};

Deno.test("simple expressions", () => {
  testExpr("123", 123);
  testExpr("2+2", 4);
  testExpr("2+2+3-1", 6);
  testExpr("1*24", 24);
  testExpr("24/2", 12);
  testExpr("2-2", 0);
  testExpr("(2+2)", 4);
  testExpr("(1*24)", 24);
  testExpr("(24/2)", 12);
  testExpr("(2-2)", 0);
});

Deno.test("operator precedence", () => {
  testExpr("2+2*3", 8);
  testExpr("2+2*3+2/4-1", 7.5);
  testExpr("2+4/2", 4);
});

Deno.test("parenthesis precedence", () => {
  testExpr("2+(4/2-2)", 2);
  testExpr("(2+2)*3", 12);
});
