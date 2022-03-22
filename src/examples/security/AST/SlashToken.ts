import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

export class SlashToken extends Node<"/"> {
  readonly kind = SyntaxKind.SlashToken;

  protected parseValue(v: unknown): "/" {
    if (v !== "/") {
      throw new Error();
    }

    return v;
  }
}
