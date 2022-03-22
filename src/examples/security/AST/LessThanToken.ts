import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class LessThanToken extends Node<"<"> {
  readonly kind = SyntaxKind.LessThanToken;

  protected parseValue(v: unknown): "<" {
    if (v !== "<") {
      throw new Error();
    }

    return v;
  }
}
