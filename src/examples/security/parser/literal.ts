import {
  oneOf,
  surrounded,
  manyTill,
  peek,
  sepBy,
  skip1,
  any,
} from "../../../combinators.ts";
import { Parser } from "../../../Parser.ts";
import { str, number, signed, double, anyChar } from "../../../parsers.ts";
import { map } from "../../../utility.ts";
import { comma } from "./atom.ts";
import { Node } from "../AST/Node.ts";
import { terminated } from "./combine/combinators.ts";
import { TrueKeyword } from "../AST/TrueKeyword.ts";
import { FalseKeyword } from "../AST/FalseKeyword.ts";
import { IntLiteral } from "../AST/IntLiteral.ts";
import { FloatLiteral } from "../AST/FloatLiteral.ts";
import { StringLiteral } from "../AST/StringLiteral.ts";
import { NullKeyword } from "../AST/NullKeyword.ts";
import { ArrayLiteralExpression } from "../AST/ArrayLiteralExpression.ts";

export type Literal = string | null | number | boolean;
export type LiteralNode = Node<Literal>;
export type BinaryExpressionNode = Node<
  [
    LiteralNode | BinaryExpressionNode,
    Node<string>,
    LiteralNode | BinaryExpressionNode
  ]
>;

export const boolLiteral = map(
  terminated(oneOf(str("true"), str("false"))),
  (v, b, a) =>
    v[0] === "true"
      ? new TrueKeyword(true, b, a)
      : new FalseKeyword(false, b, a)
);

export const intLiteral = map(
  terminated(any(number(), signed())),
  (...args) => new IntLiteral(...args)
);

export const floatLiteral = map(
  terminated(oneOf(double(), signed(double()))),
  (...args) => new FloatLiteral(...args)
);

export const stringLiteral = map(
  terminated(
    oneOf(
      surrounded(
        str('"'),
        map(manyTill(anyChar(), peek(str('"'))), (m) =>
          m.slice(0, -1).join("")
        ),
        str('"')
      ),
      surrounded(
        str("'"),
        map(manyTill(anyChar(), peek(str("'"))), (m) => {
          return m.slice(0, -1).join("");
        }),
        str("'")
      ),
      surrounded(
        str('"""'),
        map(manyTill(anyChar(), peek(str('"""'))), (m) =>
          m.slice(0, -1).join("")
        ),
        str('""""')
      )
    )
  ),
  (...args) => new StringLiteral(...args)
);

export const nullLiteral = map(
  terminated(str("null")),
  (_v, ...rest) => new NullKeyword(null, ...rest)
);

export const listLiteral = <T>(p: Parser<T>) =>
  map(
    surrounded(
      terminated(str("[")),
      map(sepBy(terminated(p), skip1(comma)), (m) =>
        m.filter((v) => v !== null)
      ),
      terminated(str("]"))
    ),
    (...args) => new ArrayLiteralExpression(...args)
  );

export const literal = any<Node>(
  floatLiteral,
  intLiteral,
  boolLiteral,
  nullLiteral,
  stringLiteral
);
