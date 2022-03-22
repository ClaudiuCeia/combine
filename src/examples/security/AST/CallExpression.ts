import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Identifier } from "./Identifier.ts";
import { Node } from "./Node.ts";
import { ParseError } from "./ParseError.ts";
import { PropertyAccessExpression } from "./PropertyAccessExpression.ts";

type CallExpressionValue = {
  identifier: Identifier | PropertyAccessExpression;
  arguments: Node[];
};

export class CallExpression extends Node<CallExpressionValue> {
  readonly kind = SyntaxKind.CallExpression;

  protected parseValue(v: unknown): CallExpressionValue {
    if (!Array.isArray(v)) {
      if (v instanceof Identifier || v instanceof PropertyAccessExpression) {
        return {
          identifier: v,
          arguments: [],
        };
      }

      throw new ParseError(`
        Can't assign "${JSON.stringify(v)}" to a CallExpression.
      `);
    }

    const [ident, args] = v;

    if (
      !(ident instanceof Identifier) &&
      !(ident instanceof PropertyAccessExpression)
    ) {
      throw new ParseError(`
        Expected an identifier, received "${ident.constructor.name}" , 
      `);
    }

    if (!Array.isArray(args) || !args.every((a) => a instanceof Node)) {
      throw new ParseError(`
        Expected an argument list, received
        "${JSON.stringify(args)}"
      `);
    }

    return {
      identifier: ident,
      arguments: args,
    };
  }
}
