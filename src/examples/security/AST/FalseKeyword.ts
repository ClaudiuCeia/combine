import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class FalseKeyword extends Node<false> {
  readonly kind = SyntaxKind.FalseKeyword;

  protected parseValue(v: unknown): false {
    if (typeof v !== "boolean" || v !== false) {
      throw new Error();
    }

    return v;
  }
}
