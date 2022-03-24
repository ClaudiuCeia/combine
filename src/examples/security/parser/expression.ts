import {
  seq,
  furthest,
  any,
  sepBy1,
  sepBy,
  skip1,
  oneOf,
  either,
  many1,
} from "../../../combinators.ts";
import { Parser } from "../../../Parser.ts";
import { str, regex } from "../../../parsers.ts";
import { map, peekAnd, lazy } from "../../../utility.ts";
import { questionMark, doubleColon, comma } from "./atom.ts";
import { paren } from "./common.ts";
import {
  elseKeyword,
  forKeyword,
  fnKeyword,
  ifKeyword,
  letKeyword,
  returnKeyword,
  breakKeyword,
  continueKeyword,
} from "./keyword.ts";
import { boolLiteral, nullLiteral, literal, listLiteral } from "./literal.ts";
import {
  mulOp,
  divOp,
  modOp,
  plusOp,
  minusOp,
  relOperator,
  logicalAnd,
  logicalOr,
  plusEq,
} from "./operator.ts";
import { keepNonNull, seqNonNull, terminated } from "./combine/combinators.ts";
import { Node } from "../AST/Node.ts";
import { Identifier } from "../AST/Identifier.ts";
import { PropertyAccessExpression } from "../AST/PropertyAccessExpression.ts";
import { CallExpression } from "../AST/CallExpression.ts";
import { BinaryExpression } from "../AST/BinaryExpression.ts";
import { ConditionalExpression } from "../AST/ConditionalExpression.ts";
import { AsteriskToken } from "../AST/AsteriskToken.ts";
import { PercentToken } from "../AST/PercentToken.ts";
import { SlashToken } from "../AST/SlashToken.ts";
import { MinusToken } from "../AST/MinusToken.ts";
import { PlusToken } from "../AST/PlusToken.ts";
import { PlusEqualsToken } from "../AST/PlusEqualsToken.ts";

export const reserved = any<Node | string>(
  boolLiteral,
  nullLiteral,
  elseKeyword,
  forKeyword,
  fnKeyword,
  ifKeyword,
  letKeyword,
  returnKeyword,
  breakKeyword,
  continueKeyword
);

const identRegex =
  /(?!true|false|null|if|else|for|function|let|return)([_a-zA-Z][_a-zA-Z0-9]*)/;

export const ident = map(
  terminated(regex(identRegex, "Expected identifier")),
  (...args) => new Identifier(...args)
);

export const unary = (): Parser<Node> =>
  furthest(
    any(
      ident,
      literal,
      listLiteral(
        any(
          literal,
          ident,
          peekAnd(seq(ident, either(str("("), str("."))), lazy(methodCall))
        )
      )
    )
  );

export const propertyAccessExpression = map(
  sepBy1(ident, str(".")),
  (v, ...rest) =>
    new PropertyAccessExpression(
      v.filter((m) => m instanceof Identifier),
      ...rest
    )
);

export const memberAccess = () => furthest(unary(), propertyAccessExpression);

export const methodArguments = (): Parser<Node[]> =>
  keepNonNull(
    sepBy(
      any(
        peekAnd(seq(ident, either(str("("), str("."))), lazy(methodCall)),
        unary(),
        lazy(expr)
      ),
      skip1(comma)
    )
  );

export const methodCall = () =>
  terminated(
    any(
      map(
        seqNonNull(
          memberAccess(),
          // TODO: properly type this
          peekAnd(str("("), paren(methodArguments())) as any
        ),
        (v, ...rest) => new CallExpression(v, ...rest)
      ),
      memberAccess()
    )
  );

export const factor = () =>
  any(
    methodCall(),
    peekAnd(
      terminated(str("(")),
      seqNonNull(
        skip1(terminated(str("("))),
        lazy(expr),
        skip1(terminated(str(")")))
      )
      // TODO: properly type this
    ) as any
  );

export const term = () =>
  furthest(
    factor(),
    map(
      seq(
        factor(),
        many1(
          seq(
            any<AsteriskToken | SlashToken | PercentToken>(mulOp, divOp, modOp),
            factor()
          )
        )
      ),
      (v, ...rest) => new BinaryExpression(v, ...rest)
      // TODO: properly type this
    ) as any
  );

export const arith = () =>
  furthest(
    term(),
    map(
      seq(
        term(),
        many1(
          seq(
            furthest<PlusToken | MinusToken | PlusEqualsToken>(
              plusOp,
              minusOp,
              plusEq
            ),
            term()
          )
        )
      ),
      (v, ...rest) => new BinaryExpression(v, ...rest)
      // TODO: properly type this
    ) as any
  );

export const relation = () =>
  furthest(
    arith(),
    map(
      seq(arith(), many1(seq(relOperator, arith()))),
      (v, ...rest) => new BinaryExpression(v, ...rest)
      // TODO: properly type this
    ) as any
  );

export const booleanAnd = () =>
  furthest(
    relation(),
    map(
      seq(relation(), many1(seq(logicalAnd, relation()))),
      (v, ...rest) => new BinaryExpression(v, ...rest)
      // TODO: properly type this
    ) as any
  );

export const booleanOr = () =>
  furthest(
    booleanAnd(),
    map(
      seq(booleanAnd(), many1(seq(logicalOr, booleanAnd()))),
      (v, ...rest) => new BinaryExpression(v, ...rest)
      // TODO: properly type this
    ) as any
  );

// TODO: Support nested ternary expressions
export const ternary = () =>
  furthest(
    booleanOr(),
    map(
      seq(
        booleanOr(),
        many1(seq(questionMark, booleanOr(), doubleColon, booleanOr()))
      ),
      (...args) => new ConditionalExpression(...args)
      // TODO: properly type this
    ) as any
  );

export function expr(): Parser<Node<unknown>> {
  return ternary();
}
