import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class PercentToken extends Node<"%"> {
  readonly kind = SyntaxKind.PercentToken;

  protected parseValue(v: unknown): "%" {
    if (v !== "%") {
      throw new Error();
    }

    return v;
  }
}
