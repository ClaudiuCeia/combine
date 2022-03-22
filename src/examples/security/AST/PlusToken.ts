import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class PlusToken extends Node<"+"> {
  readonly kind = SyntaxKind.PlusToken;

  protected parseValue(v: unknown): "+" {
    if (v !== "+") {
      throw new Error();
    }

    return v;
  }
}
