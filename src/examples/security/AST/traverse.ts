import { TraversalCallbackMap, Node } from "./Node.ts";

export function traverse(
  node: Node,
  callbackMap: Partial<TraversalCallbackMap>
): void {
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

  _traverse(node, node);
}
