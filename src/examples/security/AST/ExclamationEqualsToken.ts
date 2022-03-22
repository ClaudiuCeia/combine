import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class ExclamationEqualsToken extends Node<"!="> {
  readonly kind = SyntaxKind.ExclamationEqualsToken;

  protected parseValue(v: unknown): "!=" {
    if (v !== "!=") {
      throw new Error();
    }

    return v;
  }
}
