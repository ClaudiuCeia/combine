import { Context } from "../../../Parser.ts";
import { SyntaxKind } from "../parser/SyntaxKind.ts";

export type NodeRange = {
  readonly start: number;
  readonly end: number;
};

export abstract class Node<T = unknown> {
  public readonly range: NodeRange;
  public readonly text: string;
  public abstract readonly kind: SyntaxKind;

  public constructor(
    readonly value: unknown,
    readonly before: Context,
    readonly after: Context
  ) {
    this.range = {
      start: before.index,
      end: after.index,
    };
    this.text = before.text.slice(before.index, after.index);
    this.value = this.parseValue(value);
  }

  protected abstract parseValue(val: unknown): T;
}
