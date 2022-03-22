import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class NullKeyword extends Node<null> {
  readonly kind = SyntaxKind.NullKeyword;

  protected parseValue(v: unknown): null {
    if (v !== null) {
      throw new Error();
    }

    return v;
  }
}
