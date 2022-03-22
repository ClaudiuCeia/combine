import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { MatchPatternMiddle } from "./MatchPatternMiddle.ts";
import { MatchPatternTail } from "./MatchPatternTail.ts";
import { Node } from "./Node.ts";

type MatchPatternSpanValue = {
  expression: Node;
  literal: MatchPatternMiddle | MatchPatternTail;
};

export class MatchPatternSpan extends Node<MatchPatternSpanValue> {
  readonly kind = SyntaxKind.MatchPatternSpan;

  protected parseValue(v: unknown): MatchPatternSpanValue {
    if (!Array.isArray(v)) {
      throw new Error();
    }

    return {
      expression: v[0],
      literal: v[1],
    };
  }
}
