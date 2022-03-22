import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";
import { ParseError } from "./ParseError.ts";

export class IntLiteral extends Node<number> {
  readonly kind = SyntaxKind.IntLiteral;

  protected parseValue(v: unknown): number {
    if (typeof v !== "number") {
      throw new ParseError(`
        Can't build an IntLiteral from "${typeof v}::${v}".
      `);
    }

    return v;
  }
}
