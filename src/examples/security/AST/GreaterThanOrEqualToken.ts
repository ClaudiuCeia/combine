import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class GreaterThanOrEqualToken extends Node<">="> {
  readonly kind = SyntaxKind.GreaterThanOrEqualToken;

  protected parseValue(v: unknown): ">=" {
    if (v !== ">=") {
      throw new Error();
    }

    return v;
  }
}
