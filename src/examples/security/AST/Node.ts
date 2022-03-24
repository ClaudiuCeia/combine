import { Context } from "../../../Parser.ts";
import { SyntaxKind } from "../parser/SyntaxKind.ts";

export type NodeRange = {
  readonly start: number;
  readonly end: number;
};

export type TraversalCallbackMap = {
  [k in SyntaxKind]: (
    node: Node,
    parent?: Node,
    key?: string,
    index?: number
  ) => void;
};

export abstract class Node<T = unknown> {
  public readonly range: NodeRange;
  public readonly text: string;
  public value: T;
  public abstract readonly kind: SyntaxKind;

  public constructor(value: unknown, before: Context, after: Context) {
    this.range = {
      start: before.index,
      end: after.index,
    };
    this.text = before.text.slice(before.index, after.index);
    this.value = this.parseValue(value);
  }

  protected abstract parseValue(val: unknown): T;

  public traverse(callbackMap: Partial<TraversalCallbackMap>): void {
    const _traverse = (value: unknown, key?: string, index?: number): void => {
      if (Array.isArray(value)) {
        value.map((v, idx) => _traverse(v, undefined, idx));
      } else if (value instanceof Node) {
        value.traverse(callbackMap);
        const cb = callbackMap[value.kind];
        cb && cb(value, this, key, index);
      } else if (typeof value === "object" && value !== null) {
        Object.entries(value).reduce((acc, [k, v]) => {
          return {
            ...acc,
            [k]: _traverse(v, k),
          };
        }, {});
      }
    };

    _traverse(this.value);
  }

  /* public print(): Record<string, unknown> {
    return {
      name: this.constructor.name,
      value: Node.printValue(this.value),
      text: this.text,
      range: this.range,
    };
  } */
}
