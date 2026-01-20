import { assertObjectMatch } from "@std/assert";
import { any, chainl1, chainr1 } from "../src/combinators.ts";
import { number, str } from "../src/parsers.ts";

// Simple AST node type for testing
type Expr =
  | { type: "num"; value: number }
  | { type: "binary"; op: string; left: Expr; right: Expr };

const numExpr = (value: number): Expr => ({ type: "num", value });
const binaryExpr = (op: string, left: Expr, right: Expr): Expr => ({
  type: "binary",
  op,
  left,
  right,
});

const numParser = (ctx: { text: string; index: number }) =>
  number()({ text: ctx.text, index: ctx.index });

const term = (ctx: { text: string; index: number }) => {
  const res = numParser(ctx);
  if (res.success) {
    return { ...res, value: numExpr(res.value) };
  }
  return res;
};

Deno.test("chainl1 - single term", () => {
  const parser = chainl1(term, str("+"), (left, op, right) =>
    binaryExpr(op, left, right),
  );

  assertObjectMatch(parser({ text: "42", index: 0 }), {
    success: true,
    value: { type: "num", value: 42 },
  });
});

Deno.test("chainl1 - two terms", () => {
  const parser = chainl1(term, str("+"), (left, op, right) =>
    binaryExpr(op, left, right),
  );

  assertObjectMatch(parser({ text: "1+2", index: 0 }), {
    success: true,
    value: {
      type: "binary",
      op: "+",
      left: { type: "num", value: 1 },
      right: { type: "num", value: 2 },
    },
  });
});

Deno.test("chainl1 - three terms (left associative)", () => {
  const parser = chainl1(term, str("-"), (left, op, right) =>
    binaryExpr(op, left, right),
  );

  // 1 - 2 - 3 should parse as ((1 - 2) - 3)
  assertObjectMatch(parser({ text: "1-2-3", index: 0 }), {
    success: true,
    value: {
      type: "binary",
      op: "-",
      left: {
        type: "binary",
        op: "-",
        left: { type: "num", value: 1 },
        right: { type: "num", value: 2 },
      },
      right: { type: "num", value: 3 },
    },
  });
});

Deno.test("chainl1 - mixed operators", () => {
  const addSub = any(str("+"), str("-"));
  const parser = chainl1(term, addSub, (left, op, right) =>
    binaryExpr(op, left, right),
  );

  // 1 + 2 - 3 should parse as ((1 + 2) - 3)
  assertObjectMatch(parser({ text: "1+2-3", index: 0 }), {
    success: true,
    value: {
      type: "binary",
      op: "-",
      left: {
        type: "binary",
        op: "+",
        left: { type: "num", value: 1 },
        right: { type: "num", value: 2 },
      },
      right: { type: "num", value: 3 },
    },
  });
});

Deno.test("chainr1 - single term", () => {
  const parser = chainr1(term, str("**"), (left, op, right) =>
    binaryExpr(op, left, right),
  );

  assertObjectMatch(parser({ text: "42", index: 0 }), {
    success: true,
    value: { type: "num", value: 42 },
  });
});

Deno.test("chainr1 - two terms", () => {
  const parser = chainr1(term, str("**"), (left, op, right) =>
    binaryExpr(op, left, right),
  );

  assertObjectMatch(parser({ text: "2**3", index: 0 }), {
    success: true,
    value: {
      type: "binary",
      op: "**",
      left: { type: "num", value: 2 },
      right: { type: "num", value: 3 },
    },
  });
});

Deno.test("chainr1 - three terms (right associative)", () => {
  const parser = chainr1(term, str("**"), (left, op, right) =>
    binaryExpr(op, left, right),
  );

  // 2 ** 3 ** 4 should parse as (2 ** (3 ** 4))
  assertObjectMatch(parser({ text: "2**3**4", index: 0 }), {
    success: true,
    value: {
      type: "binary",
      op: "**",
      left: { type: "num", value: 2 },
      right: {
        type: "binary",
        op: "**",
        left: { type: "num", value: 3 },
        right: { type: "num", value: 4 },
      },
    },
  });
});

// Verify left vs right associativity difference
Deno.test("chainl1 vs chainr1 - associativity difference", () => {
  const leftParser = chainl1(term, str("^"), (left, op, right) =>
    binaryExpr(op, left, right),
  );

  const rightParser = chainr1(term, str("^"), (left, op, right) =>
    binaryExpr(op, left, right),
  );

  // 1 ^ 2 ^ 3 with left associativity: ((1 ^ 2) ^ 3)
  const leftResult = leftParser({ text: "1^2^3", index: 0 });
  assertObjectMatch(leftResult, {
    success: true,
    value: {
      type: "binary",
      op: "^",
      left: {
        type: "binary",
        op: "^",
        left: { type: "num", value: 1 },
        right: { type: "num", value: 2 },
      },
      right: { type: "num", value: 3 },
    },
  });

  // 1 ^ 2 ^ 3 with right associativity: (1 ^ (2 ^ 3))
  const rightResult = rightParser({ text: "1^2^3", index: 0 });
  assertObjectMatch(rightResult, {
    success: true,
    value: {
      type: "binary",
      op: "^",
      left: { type: "num", value: 1 },
      right: {
        type: "binary",
        op: "^",
        left: { type: "num", value: 2 },
        right: { type: "num", value: 3 },
      },
    },
  });
});
