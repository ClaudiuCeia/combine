import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class MatchPatternTail extends Node<string> {
  readonly kind = SyntaxKind.MatchPatternTail;

  protected parseValue(v: unknown): string {
    if (typeof v !== "string") {
      throw new Error();
    }

    return v;
  }
}
