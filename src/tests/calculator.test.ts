import { assertObjectMatch } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { either, many, oneOf, seq, surrounded } from "../combinators.ts";
import { Parser } from "../Parser.ts";
import { number, str } from "../parsers.ts";
import { lazy, map, peekAnd } from "../utility.ts";

/**
 * An implementation of a simple calculator.
 */
const paren = <T>(parser: Parser<T>): Parser<T> =>
  surrounded(str("("), parser, str(")"));

const addop = either(str("+"), str("-"));
const mulop = either(str("*"), str("/"));

function expression(): Parser<number> {
  return map(seq(term(), many(seq(addop, term()))), ([term, maybeRest]) => {
    if (!maybeRest) {
      return term;
    }

    let total = term;
    for (const pair of maybeRest) {
      const [op, term2] = pair;
      switch (op) {
        case "+": {
          total += term2;
          break;
        }
        case "-": {
          total -= term2;
          break;
        }
        default:
          throw new Error("Expected addition or substraction");
      }
    }

    return total;
  });
}

function term(): Parser<number> {
  return map(
    seq(factor(), many(seq(mulop, factor()))),
    ([factor, maybeRest]) => {
      if (!maybeRest) {
        return factor;
      }

      let total = factor;
      for (const pair of maybeRest) {
        const [op, factor2] = pair;
        switch (op) {
          case "*": {
            total *= factor2;
            break;
          }
          case "/": {
            total /= factor2;
            break;
          }
          default:
            throw new Error("Expected multiplication or division");
        }
      }

      return total;
    }
  );
}

function factor(): Parser<number> {
  return map(
    oneOf(
      peekAnd(
        str("("),
        lazy(() => paren(expression()))
      ),
      number()
    ),
    (maybeNum) => {
      if (maybeNum === null) {
        throw new Error("Panic at the disco");
      }

      return maybeNum;
    }
  );
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
  testExpr("2+(4/2 -2)", 2);
  testExpr("(2+2)*3", 12);
});
