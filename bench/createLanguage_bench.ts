import { surrounded, either, seq, many, oneOf } from "../src/combinators.ts";
import { createLanguage, UntypedLanguage } from "../src/language.ts";
import { Parser } from "../src/Parser.ts";
import { str, number } from "../src/parsers.ts";
import { map, peekAnd, lazy } from "../src/utility.ts";

const text = `2+2*3+2/4-1+2+2*3+(2/(4-1+2+2*3+2/4-1+2+2*3+2/4-1+2+2*3+2/4-1+2+2)*3+2/4-1+2+2*3+2/4-1`;

const paren = <T>(parser: Parser<T>): Parser<T> =>
  surrounded(str("("), parser, str(")"));

Deno.bench("createLanguage", { group: "calculator" }, () => {
  const C = createLanguage<UntypedLanguage>({
    AddOp: () => either(str("+"), str("-")),
    MulOp: () => either(str("*"), str("/")),
    Factor: (s) => {
      return map(
        oneOf(peekAnd(str("("), paren(s.Expression)), number()),
        (maybeNum) => {
          if (maybeNum === null) {
            throw new Error("Panic at the disco");
          }

          return maybeNum;
        }
      );
    },
    Term: (s) => {
      return map(
        seq(
          s.Factor as Parser<number>,
          many(seq(s.MulOp, s.Factor)) as Parser<[string, number][]>
        ),
        ([factor, maybeRest]: [number, [string, number][]]) => {
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
    },
    Expression: (s) => {
      return map(
        seq(
          s.Term as Parser<number>,
          many(seq(s.AddOp, s.Term)) as Parser<[string, number][]>
        ),
        ([term, maybeRest]) => {
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
        }
      );
    },
  });

  C.Expression({ text, index: 0 });
});

Deno.bench("raw", { group: "calculator", baseline: true }, () => {
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

  expression()({ text, index: 0 });
});
