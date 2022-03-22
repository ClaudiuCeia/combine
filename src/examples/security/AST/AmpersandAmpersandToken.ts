import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class AmpersandAmpersandToken extends Node<"&&"> {
  readonly kind = SyntaxKind.AmpersandAmpersandToken;

  protected parseValue(v: unknown): "&&" {
    if (v !== "&&") {
      throw new Error();
    }

    return v;
  }
}
