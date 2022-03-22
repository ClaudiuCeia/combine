import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

type VariableDeclarationValue = {
  name: Node;
  initializer?: Node;
};

export class VariableDeclaration extends Node<VariableDeclarationValue> {
  readonly kind = SyntaxKind.VariableDeclaration;

  protected parseValue(v: unknown): VariableDeclarationValue {
    if (!Array.isArray(v)) {
      throw new Error();
    }

    return {
      name: v[0],
      initializer: v[1],
    };
  }
}
