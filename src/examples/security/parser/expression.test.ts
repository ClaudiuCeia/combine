import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { expr } from "./expression.ts";

Deno.test("Unary expressions", () => {
  const expressions = [
    `50`,
    `foo(42)`,
    `foo.bar(42)`,
    `foo.bar.baz(42)`,
    `foo.bar(42, true, "baz", [1, 2, 3])`,
    `foo(42, foo.bar.baz(5, true, false))`,
  ];

  for (const e of expressions) {
    const res = expr()({ text: e, index: 0 });
    assertEquals(res.ctx.index, e.length);
    assertEquals(res.success, true);
  }
});

Deno.test("Binary expressions", () => {
  const expressions = [
    `1 + 2`,
    `1 + 2 + 3`,
    `1 + 2 / (3 - 4) + 4 % 2`,
    `1 + foo.bar.baz(42) - (foo(42) * 2)`,
    `a || b && false`,
    `a || b(c) && d(e)`,
    `i <= a.length`,
    `a += 1`,
  ];

  for (const e of expressions) {
    const res = expr()({ text: e, index: 0 });

    assertEquals(res.ctx.index, e.length);
    assertEquals(res.success, true);
  }
});

Deno.test("Conditional expressions", () => {
  const expressions = [
    `a ? 1 + 2 / (3 - 4) + 4 % 2 : 1 + foo.bar.baz(42) - (foo(42) * 2)`,
    `a ? b : c`,
    `a ? 4 : "false"`,
  ];

  for (const e of expressions) {
    const res = expr()({ text: e, index: 0 });
    assertEquals(res.ctx.index, e.length);
    assertEquals(res.success, true);
  }
});
