import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class MatchPatternMiddle extends Node<string> {
  readonly kind = SyntaxKind.MatchPatternMiddle;

  protected parseValue(v: unknown): string {
    if (typeof v !== "string") {
      throw new Error();
    }

    return v;
  }
}
