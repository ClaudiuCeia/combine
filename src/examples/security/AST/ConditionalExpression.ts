import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

type ConditionalExpressionValue<Cond, Left, Right> = {
  condition: Node<Cond>;
  left: Node<Left>;
  right: Node<Right>;
};

export class ConditionalExpression<Cond, Left, Right> extends Node<
  ConditionalExpressionValue<Cond, Left, Right>
> {
  readonly kind = SyntaxKind.ConditionalExpression;

  protected parseValue(
    v: unknown
  ): ConditionalExpressionValue<Cond, Left, Right> {
    if (!Array.isArray(v) || v.length !== 2) {
      throw new Error();
    }

    return {
      condition: v[0],
      left: v[1][0],
      right: v[1][1],
    };
  }
}
