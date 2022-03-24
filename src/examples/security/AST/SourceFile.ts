import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { MatchDeclaration } from "./MatchDeclaration.ts";
import { Node } from "./Node.ts";

type SourceFileValue = {
  statements: MatchDeclaration[];
  endOfFileToken: Node;
};
export class SourceFile extends Node<SourceFileValue> {
  readonly kind = SyntaxKind.RuleKind;

  protected parseValue(v: unknown): SourceFileValue {
    if (!Array.isArray(v)) {
      throw new Error();
    }

    return {
      statements: v.slice(0, -1),
      endOfFileToken: v[v.length - 1],
    };
  }
}
