import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Identifier } from "./Identifier.ts";
import { Node } from "./Node.ts";

export class PropertyAccessExpression extends Node<Identifier[]> {
  readonly kind = SyntaxKind.PropertyAccessExpression;

  protected parseValue(v: unknown): Identifier[] {
    if (!Array.isArray(v) || !v.every((m) => m instanceof Identifier)) {
      throw Error();
    }

    return v;
  }
}
