import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

type DenyRuleValue = {
  expression: Node;
};
export class DenyRule extends Node<DenyRuleValue> {
  readonly kind = SyntaxKind.DenyRule;

  protected parseValue(v: unknown): DenyRuleValue {
    if (!(v instanceof Node)) {
      throw new Error();
    }

    return {
      expression: v,
    };
  }
}
