import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class GreaterThanToken extends Node<">"> {
  readonly kind = SyntaxKind.GreaterThanToken;

  protected parseValue(v: unknown): ">" {
    if (v !== ">") {
      throw new Error();
    }

    return v;
  }
}
