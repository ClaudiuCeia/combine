import { SyntaxKind } from "../parser/SyntaxKind.ts";
import { Node } from "./Node.ts";

const obj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const tr = (kind: SyntaxKind): string | undefined =>
  Object.entries(SyntaxKind).reduce((acc, [k, v]) => {
    return v === kind ? k : acc;
  }, undefined as undefined | string);

export const prettyPrintAST = (
  tree: unknown
): Record<string, unknown> | undefined | unknown => {
  const isAstNode = (n: unknown): n is Node<unknown> => {
    return obj(n) && "kind" in n;
  };

  let interm;
  if (!isAstNode(tree)) {
    if (!Array.isArray(tree)) {
      interm = JSON.stringify(tree);
    } else {
      interm = tree.map(prettyPrintAST);
    }
  } else {
    interm = {
      name: tr(tree.kind),
      text: tree.text,
      loc: [tree.range.start, tree.range.end],
      value: prettyPrintAST(tree.value),
    };
  }

  return interm;
};

export const printNode = (n: Node<unknown>): Record<string, unknown> => {
  let value = n.value;
  if (Array.isArray(value)) {
    value = value.map((v) =>
      obj(v) && "kind" in v ? printNode(v as Node<unknown>) : v
    );
  } else if (obj(value) && "kind" in value) {
    value = printNode(value as Node<unknown>);
  }

  return {
    value,
    type: tr(n.kind),
    loc: [n.range.start, n.range.end],
    text: n.text,
  };
};

export const printAstSummary = (
  ast: Record<string, unknown> | unknown[]
): Record<string, unknown> | unknown[] => {
  if (obj(ast)) {
    return {
      _label: ast.type,
      _children: Array.isArray(ast.value)
        ? ast.value.map(printAstSummary)
        : obj(ast) && "value" in ast
        ? printAstSummary(ast.value as Record<string, unknown>)
        : ast.value,
    };
  }

  if (Array.isArray(ast)) {
    return ast.map(printAstSummary);
  }

  return ast;
};
