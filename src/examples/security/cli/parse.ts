import { assert } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { AsteriskToken } from "../AST/AsteriskToken.ts";
import {
  BinaryExpression,
  BinaryExpressionValue,
} from "../AST/BinaryExpression.ts";
import { IfStatement } from "../AST/IfStatement.ts";
import { IntLiteral } from "../AST/IntLiteral.ts";
import { MinusToken } from "../AST/MinusToken.ts";
import { Node, TraversalCallbackMap } from "../AST/Node.ts";
import { PlusToken } from "../AST/PlusToken.ts";
import { SlashToken } from "../AST/SlashToken.ts";
import { traverse } from "../AST/traverse.ts";
import { VariableDeclaration } from "../AST/VariableDeclaration.ts";
import { VariableDeclarationList } from "../AST/VariableDeclarationList.ts";
import { program } from "../parser/program.ts";
import { SyntaxKind } from "../parser/SyntaxKind.ts";

const args = Deno.args;

if (args.length === 0) {
  Deno.exit(1);
}

const replaceWith = (val: unknown, p?: Node, key?: string, index?: number) => {
  assert(p);
  if (key) {
    if (index) {
      // deno-lint-ignore no-explicit-any
      (p.value as any)[key][index] = val;
      return;
    }
    // deno-lint-ignore no-explicit-any
    (p.value as any)[key] = val;
  } else if (index) {
    // deno-lint-ignore no-explicit-any
    (p.value as any)[index] = val;
  }
};

const remove = (p: Node, key: string, index?: number) => {
  if (key) {
    if (index !== undefined) {
      // console.log("rem", p.constructor.name, key, index);
      (p.value as Record<string, unknown[]>)[key].splice(index, 1);
      return;
    } else {
      delete (p.value as Record<string, unknown>)[key];
    }
  } else if (index !== undefined) {
    (p.value as unknown[]).splice(index, 1);
  }
};

const map: Partial<TraversalCallbackMap> = {
  [SyntaxKind.IntLiteral]: (n: Node, ...rest) => {
    replaceWith(n.value, ...rest);
  },
  [SyntaxKind.TrueKeyword]: (n: Node, ...rest) => {
    replaceWith(n.value, ...rest);
  },
  [SyntaxKind.FalseKeyword]: (n: Node, ...rest) => {
    replaceWith(n.value, ...rest);
  },
  [SyntaxKind.StringLiteral]: (n: Node, ...rest) => {
    replaceWith(n.value, ...rest);
  },
  /* [SyntaxKind.Identifier]: (n: Node, parent?: Node, ...rest) => {
    assert(parent);
    assert(typeof n.value === "string");
    const value = parent.scope.locals[n.value];
    if (value) {
      replaceWith(value, parent, ...rest);
    }
  }, */
  [SyntaxKind.VariableDeclaration]: (node, parent, key, index) => {
    assert(node instanceof VariableDeclaration);
    assert(parent && key);

    const { name, initializer } = node.value;
    assert(typeof name.value === "string");

    if (!(initializer instanceof Node)) {
      parent.scope.locals[name.value] = initializer;
    }

    // remove(parent, key, index);
    // this.remove();
  },
  [SyntaxKind.VariableDeclarationList]: (node, parent, key, index) => {
    assert(node instanceof VariableDeclarationList);
    assert(parent && key);

    parent.scope.locals = {
      ...parent.scope.locals,
      ...node.scope.locals,
    };

    // console.log("should rem", key, index);
    remove(parent, key, index);
    // this.remove();
  },
  [SyntaxKind.IfStatement]: (n: Node, ...rest) => {
    assert(n instanceof IfStatement);
    const { expression, elseStatement, thenStatement } = n.value;
    assert(typeof expression === "boolean");

    console.log("if locals", n.scope);
    /* parent.scope.locals = {
      ...parent.scope.locals,
      ...node.scope.locals,
    }; */

    /* if (expression === true) {
      replaceWith(thenStatement, ...rest);
    } else {
      if (elseStatement) {
        replaceWith(elseStatement, ...rest);
      }
    } */
  },
  [SyntaxKind.BinaryExpression]: (n: Node, ...rest) => {
    assert(n instanceof BinaryExpression);

    const { left, op, right } = n.value;
    /* const leftV = left.value,
      rightV = right.value; */
    const leftV = left,
      rightV = right;

    if (typeof leftV === "number" && typeof rightV === "number") {
      switch (op.kind) {
        case SyntaxKind.AsteriskToken:
          replaceWith(leftV * rightV, ...rest);
          return;
        case SyntaxKind.SlashToken:
          replaceWith(leftV / rightV, ...rest);
          return;
        case SyntaxKind.MinusToken:
          replaceWith(leftV - rightV, ...rest);
          return;
        case SyntaxKind.PlusToken:
          replaceWith(leftV + rightV, ...rest);
          return;
        case SyntaxKind.PercentToken:
          replaceWith(leftV % rightV, ...rest);
          return;
        case SyntaxKind.LessThanToken:
          replaceWith(leftV < rightV, ...rest);
          return;
        case SyntaxKind.LessThanOrEqualToken:
          replaceWith(leftV <= rightV, ...rest);
          return;
        case SyntaxKind.GreaterThanOrEqualToken:
          replaceWith(leftV >= rightV, ...rest);
          return;
        case SyntaxKind.GreaterThanToken:
          replaceWith(leftV > rightV, ...rest);
          return;
        case SyntaxKind.EqualsEqualsToken:
          replaceWith(leftV === rightV, ...rest);
          return;
      }
    }

    if (typeof leftV === "boolean" || typeof rightV === "boolean") {
      switch (op.kind) {
        case SyntaxKind.BarBarToken:
          replaceWith(leftV || rightV, ...rest);
          return;
        case SyntaxKind.AmpersandAmpersandToken:
          replaceWith(leftV && rightV, ...rest);
          return;
      }
    }
  },
};

const parsetree = program()({ text: args[0], index: 0 });
if (parsetree.success) {
  const value = parsetree.value;
  traverse(value, map);
  console.log(JSON.stringify(value));
  Deno.exit(0);
}

console.log(JSON.stringify(parsetree, undefined, 2));
Deno.exit(1);
