import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Identifier } from "./Identifier.ts";
import { Node } from "./Node.ts";
import { Parameter } from "./Parameter.ts";

type FunctionDeclarationValue = {
  name: Identifier;
  parameters: Parameter[];
  body: Node;
};

export class FunctionDeclaration extends Node<FunctionDeclarationValue> {
  readonly kind = SyntaxKind.FunctionDeclaration;

  protected parseValue(v: unknown): FunctionDeclarationValue {
    if (!Array.isArray(v)) {
      throw new Error();
    }

    return {
      name: v[0],
      parameters: v[1],
      body: v[2],
    };
  }
}
