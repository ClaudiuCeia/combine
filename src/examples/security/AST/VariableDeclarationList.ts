import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

type VariableDeclarationListValue = {
  declarations: Node[];
};

export class VariableDeclarationList extends Node<VariableDeclarationListValue> {
  readonly kind = SyntaxKind.VariableDeclarationList;

  protected parseValue(v: unknown): VariableDeclarationListValue {
    if (!Array.isArray(v)) {
      throw new Error();
    }

    return {
      declarations: v,
    };
  }
}
