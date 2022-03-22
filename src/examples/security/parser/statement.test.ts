import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { returnStatement, statement } from "./statement.ts";

Deno.test("variable declaration", () => {
  const statements = [
    `let i = 40;`,
    `let i = 4.10;`,
    `let i, j, k = 30;`,
    `let i, j, k = [30, 40], l, m = "trueish";`,
  ];
  for (const st of statements) {
    const res = statement()({
      text: st,
      index: 0,
    });

    assertEquals(res.ctx.index, res.ctx.text.length, JSON.stringify(res.ctx));
    assertEquals(res.success, true);
  }
});

Deno.test("return", () => {
  const res = returnStatement()({
    text: "return toYears(userbirthdate()) - age;",
    index: 0,
  });

  assertEquals(res.success, true);
});
