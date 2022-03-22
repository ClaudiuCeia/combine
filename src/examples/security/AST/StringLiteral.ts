import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class StringLiteral extends Node<string> {
  readonly kind = SyntaxKind.StringLiteral;

  protected parseValue(v: unknown): string {
    if (typeof v !== "string") {
      throw new Error();
    }

    return v;
  }
}
