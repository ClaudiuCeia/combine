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

  private static printValue(value: unknown): unknown {
    let out;
    if (Array.isArray(value)) {
      out = value.map((v) => this.printValue(v));
    } else if (value instanceof Node) {
      out = value.print();
    } else if (typeof value === "object" && value !== null) {
      out = Object.entries(value).reduce((acc, [k, v]) => {
        return {
          ...acc,
          [k]: this.printValue(v),
        };
      }, {});
    } else {
      out = value;
    }

    return out;
  }

  public print(): Record<string, unknown> {
    return {
      name: this.constructor.name,
      value: Node.printValue(this.value),
      text: this.text,
      range: this.range,
    };
  }
}
