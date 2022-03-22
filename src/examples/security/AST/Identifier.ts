import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class Identifier extends Node<string> {
  readonly kind = SyntaxKind.Identifier;

  protected parseValue(v: unknown): string {
    if (typeof v !== "string") {
      throw new Error();
    }

    return v;
  }
}
