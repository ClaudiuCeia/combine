import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class ArrayLiteralExpression extends Node<Node[]> {
  readonly kind = SyntaxKind.ArrayLiteralExpression;

  protected parseValue(v: unknown): Node[] {
    if (!Array.isArray(v) || !v.every((m) => m instanceof Node)) {
      throw new Error();
    }

    return v;
  }
}
