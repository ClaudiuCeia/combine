import { Context } from "../../../Parser.ts";
import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

const identity = <I, T>(v: I) => v as unknown as T;

export const node1 =
  <I, T>(kind: SyntaxKind, transformer: (val: I) => T = (v) => identity(v)) =>
  (value: I, before: Context, after: Context): Node<T> => {
    if (kind === SyntaxKind.BinaryExpression) {
      console.log(JSON.stringify(value, undefined, 2));
    }

    return {
      kind,
      range: {
        start: before.index,
        end: after.index,
      },
      value: transformer(value),
      text: before.text.slice(before.index, after.index),
    };
  };

/* 
export const node = <T>(
  kind: SyntaxKind,
  value: T,
  before: Context,
  after: Context
): Node<T> => {
  return {
    kind,
    range: {
      start: before.index,
      end: after.index,
    },
    value,
  };
};
 */
