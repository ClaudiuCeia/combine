import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

type AllowRuleValue = {
  expression: Node;
};

export class AllowRule extends Node<AllowRuleValue> {
  readonly kind = SyntaxKind.AllowRule;

  protected parseValue(v: unknown): AllowRuleValue {
    if (!(v instanceof Node)) {
      throw new Error();
    }

    return {
      expression: v,
    };
  }
}
