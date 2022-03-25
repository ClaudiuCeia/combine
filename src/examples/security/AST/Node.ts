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

type Scope = {
  locals: Record<string, unknown>;
};

export abstract class Node<T = unknown> {
  public readonly range: NodeRange;
  public readonly text: string;
  public value: T;
  public abstract readonly kind: SyntaxKind;
  public scope: Scope = {
    locals: {},
  };

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
    const _traverse = (
      child: unknown,
      parent?: Node,
      key?: string,
      index?: number
    ): void => {
      if (Array.isArray(child)) {
        for (let i = 0; i <= child.length; i++) {
          const original = child[i];
          _traverse(original, parent, key, i);
          // If the node was deleted, we need to reset to avoid skipping a node
          if (original !== child[i]) {
            i--;
          }
        }
      } else if (child instanceof Node) {
        _traverse(child.value, child, key);
        const cb = callbackMap[child.kind];
        cb && cb(child, parent, key, index);
      } else if (typeof child === "object" && child !== null) {
        Object.entries(child).reduce((acc, [k, v]) => {
          return {
            ...acc,
            [k]: _traverse(v, parent, k),
          };
        }, {});
      }
    };

    _traverse(this, this);
  }
}
