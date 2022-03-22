import { Context } from "../../../Parser.ts";
import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { BinaryExpression } from "./BinaryExpression.ts";
import { Node } from "./Node.ts";

export const createNode =
  (kind: SyntaxKind) =>
  (value: unknown, before: Context, after: Context): Node => {
    switch (kind) {
      case SyntaxKind.BinaryExpression: {
        return new BinaryExpression(value, before, after);
      }
    }

    throw new Error("Unimplemented");
  };
