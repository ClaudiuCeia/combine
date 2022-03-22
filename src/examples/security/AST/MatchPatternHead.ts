import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class MatchPatternHead extends Node<string> {
  readonly kind = SyntaxKind.MatchPatternHead;

  protected parseValue(v: unknown): string {
    if (typeof v !== "string") {
      throw new Error();
    }

    return v;
  }
}
