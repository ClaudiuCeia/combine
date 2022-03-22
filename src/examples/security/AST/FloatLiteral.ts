import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class FloatLiteral extends Node<number> {
  readonly kind = SyntaxKind.FloatLiteral;

  protected parseValue(v: unknown): number {
    if (typeof v !== "number") {
      throw new Error();
    }

    return v;
  }
}
