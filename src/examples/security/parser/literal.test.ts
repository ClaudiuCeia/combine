import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { floatLiteral } from "./literal.ts";

Deno.test("float", () => {
  const res = floatLiteral({
    text: "4.20",
    index: 0,
  });

  assertEquals(res.success, true);
  assertEquals(res.ctx.text.length, res.ctx.index);
});
