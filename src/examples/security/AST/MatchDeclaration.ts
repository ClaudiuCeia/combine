import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Block } from "./Block.ts";
import { MatchPatternExpression } from "./MatchPatternExpression.ts";
import { Node } from "./Node.ts";

type MatchDeclarationValue = {
  pattern: MatchPatternExpression;
  body: Block;
};
export class MatchDeclaration extends Node<MatchDeclarationValue> {
  readonly kind = SyntaxKind.MatchDeclaration;

  protected parseValue(v: unknown): MatchDeclarationValue {
    if (!Array.isArray(v)) {
      throw new Error();
    }

    return {
      pattern: v[0],
      body: v[1],
    };
  }
}
