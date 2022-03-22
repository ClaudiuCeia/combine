import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

type BlockValue = {
  statements: Node[];
};

export class Block extends Node<BlockValue> {
  readonly kind = SyntaxKind.Block;

  protected parseValue(v: unknown): BlockValue {
    if (!Array.isArray(v)) {
      throw new Error();
    }

    return {
      statements: v,
    };
  }
}
