import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class EndOfFileToken extends Node<unknown> {
  readonly kind = SyntaxKind.EndOfFileToken;

  protected parseValue(v: unknown): unknown {
    return v;
  }
}
