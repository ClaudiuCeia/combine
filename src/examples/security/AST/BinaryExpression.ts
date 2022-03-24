import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";
import { ParseError } from "./ParseError.ts";

export type BinaryExpressionValue<Left, Op, Right> = {
  left: Node<Left>;
  op: Node<Op>;
  right: Node<Right>;
};

export class BinaryExpression<
  Left = unknown,
  Op = unknown,
  Right = unknown
> extends Node<BinaryExpressionValue<Left, Op, Right>> {
  readonly kind = SyntaxKind.BinaryExpression;

  protected parseValue(v: unknown): BinaryExpressionValue<Left, Op, Right> {
    if (!Array.isArray(v) || v.length !== 2) {
      throw new ParseError(`
        Can't assign "${JSON.stringify(v)}" to a BinaryExpression.
      `);
    }

    const [left, tuples] = v;

    if (!(left instanceof Node)) {
      throw new ParseError(`
        Expected left member to be a node, received "${left}". 
      `);
    }

    /**
     * Binary expressions are parsed as [left, [op, right][]]
     * so we need to collapse these into a single binary expression
     */
    return tuples.reduce(
      (
        acc: BinaryExpressionValue<unknown, unknown, unknown>,
        [op, right]: [Node<unknown>, Node<unknown>]
      ) => {
        return {
          left: acc,
          op,
          right,
        };
      },
      {
        left,
        op: tuples[0][0],
        right: tuples[0][1],
      }
    ).left;
  }
}
