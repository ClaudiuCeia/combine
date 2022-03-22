import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { MatchPatternHead } from "./MatchPatternHead.ts";
import { MatchPatternSpan } from "./MatchPatternSpan.ts";
import { Node } from "./Node.ts";

type MatchPatternExpressionValue = {
  head: MatchPatternHead;
  patternSpans: MatchPatternSpan[];
};
export class MatchPatternExpression extends Node<MatchPatternExpressionValue> {
  readonly kind = SyntaxKind.MatchPatternExpression;

  protected parseValue(v: unknown): MatchPatternExpressionValue {
    if (!Array.isArray(v)) {
      throw new Error();
    }

    return {
      head: v[0],
      patternSpans: v[1],
    };
  }
}
