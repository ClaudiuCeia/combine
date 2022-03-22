import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

type ReturnStatementValue = {
  expression: Node;
};

export class ReturnStatement extends Node<ReturnStatementValue> {
  readonly kind = SyntaxKind.ReturnStatement;

  protected parseValue(v: unknown): ReturnStatementValue {
    if (!(v instanceof Node)) {
      console.log(v);
      throw new Error();
    }

    return {
      expression: v,
    };
  }
}
