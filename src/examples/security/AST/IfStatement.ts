import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

type IfStatementValue = {
  expression: Node;
  thenStatement: Node;
  elseStatement: Node;
};

export class IfStatement extends Node<IfStatementValue> {
  readonly kind = SyntaxKind.IfStatement;

  protected parseValue(v: unknown): IfStatementValue {
    if (!Array.isArray(v)) {
      throw new Error();
    }

    return {
      expression: v[0],
      thenStatement: v[1].map((v: [unknown]) => v[0]),
      elseStatement: v[2],
    };
  }
}
