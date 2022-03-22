import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

type ForStatementValue = {
  initializer: Node;
  condition: Node;
  incrementor: Node;
  statement: Node;
};

export class ForStatement extends Node<ForStatementValue> {
  readonly kind = SyntaxKind.ForStatement;

  protected parseValue(v: unknown): ForStatementValue {
    if (!Array.isArray(v)) {
      throw new Error();
    }

    return {
      initializer: v[0][0],
      condition: v[0][1],
      incrementor: v[0][2],
      statement: v[1],
    };
  }
}
