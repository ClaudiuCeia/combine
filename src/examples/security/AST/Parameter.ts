import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Identifier } from "./Identifier.ts";
import { Node } from "./Node.ts";

type ParameterValue = {
  name: Identifier;
  intializer?: Node;
};

export class Parameter extends Node<ParameterValue> {
  readonly kind = SyntaxKind.Parameter;

  protected parseValue(v: unknown): ParameterValue {
    if (!Array.isArray(v)) {
      throw new Error();
    }

    return {
      name: v[0],
      intializer: v[1],
    };
  }
}
