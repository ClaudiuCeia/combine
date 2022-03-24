import { assert } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { AsteriskToken } from "../AST/AsteriskToken.ts";
import {
  BinaryExpression,
  BinaryExpressionValue,
} from "../AST/BinaryExpression.ts";
import { IntLiteral } from "../AST/IntLiteral.ts";
import { MinusToken } from "../AST/MinusToken.ts";
import { Node, TraversalCallbackMap } from "../AST/Node.ts";
import { PlusToken } from "../AST/PlusToken.ts";
import { SlashToken } from "../AST/SlashToken.ts";
import { program } from "../parser/program.ts";
import { SyntaxKind } from "../parser/SyntaxKind.ts";

const args = Deno.args;

if (args.length === 0) {
  Deno.exit(1);
}

const assign = (val: unknown, p?: Node, key?: string, index?: number) => {
  assert(p);
  if (key) {
    console.log("assign key", key);
    (p.value as Record<string, unknown>)[key] = val;
  } else if (index) {
    console.log("assign index", index);
    (p.value as unknown[])[index] = val;
  }
};

const map: Partial<TraversalCallbackMap> = {
  [SyntaxKind.IntLiteral]: (
    n: Node,
    p?: Node,
    key?: string,
    index?: number
  ) => {
    console.log("Replaced", n, n.value);
    assign(n.value, p, key, index);
  },
  [SyntaxKind.BinaryExpression]: (n: Node, p?: Node, ...rest: []) => {
    assert(p);
    assert(n instanceof BinaryExpression);
    const { left, right, op } = n.value;

    switch (op.value) {
      case "*": {
        assign((left as any) * (right as any), p, ...rest);
        break;
      }
      case "/": {
        assign((left as any) / (right as any), p, ...rest);
        break;
      }
      case "+": {
        console.log("assigning for", p, "at", ...rest);
        assign((left as any) + (right as any), p, ...rest);
        break;
      }
      case "-": {
        assign((left as any) - (right as any), p, ...rest);
        break;
      }
    }

    console.log(
      "Did",
      n.text,
      " and came up with ",
      p.value,
      "for ",
      `"${op.value}"`
    );
  },
};
const parsetree = program()({ text: args[0], index: 0 });
if (parsetree.success) {
  let c = 0;
  console.log(JSON.stringify(parsetree.value.traverse(map)));
  // console.log(JSON.stringify(parsetree.value.serialize(), undefined, 2));
  Deno.exit(0);
}

console.log(JSON.stringify(parsetree, undefined, 2));
Deno.exit(1);
