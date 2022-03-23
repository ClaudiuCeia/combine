import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";
import { RuleAction } from "./RuleAction.ts";
import { RuleKind } from "./RuleKind.ts";

type RuleValue = {
  kind: RuleKind;
  actions: RuleAction[];
  conditon: Node;
};
export class Rule extends Node<RuleValue> {
  readonly kind = SyntaxKind.Rule;

  protected parseValue(v: unknown): RuleValue {
    if (!Array.isArray(v)) {
      throw new Error();
    }

    return {
      kind: v[0],
      actions: v[1],
      conditon: v[2],
    };
  }
}
