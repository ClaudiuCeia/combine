import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class AsteriskToken extends Node<"*"> {
  readonly kind = SyntaxKind.AsteriskToken;

  protected parseValue(v: unknown): "*" {
    if (v !== "*") {
      throw new Error();
    }

    return v;
  }
}
