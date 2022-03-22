import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class TrueKeyword extends Node<true> {
  readonly kind = SyntaxKind.TrueKeyword;

  protected parseValue(v: unknown): true {
    if (typeof v !== "boolean" || v !== true) {
      throw new Error();
    }

    return v;
  }
}
