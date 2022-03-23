import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { MatchDeclaration } from "./MatchDeclaration.ts";
import { Node } from "./Node.ts";

type SourceFileValue = {
    statements: MatchDeclaration[],
    endOfFileToken: Node;
}
export class RuleKind extends Node<"allow" | "deny"> {
  readonly kind = SyntaxKind.RuleKind;

  protected parseValue(v: unknown): "allow" | "deny" {
    if (v !== "allow" && v !== "deny") {
      throw new Error();
    }

    return v;
  }
}
