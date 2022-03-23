import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { functionDeclaration } from "./function.ts";

Deno.test("function declaration", () => {
  const res = functionDeclaration()({
    text: `function foo(age, foo ) /*foo*/ {
              let user = get(uuid);
              if (user.tenant == Tenant.ADMIN) {
                return false;
              }

              return toYears(user.birthdate) - age;
            }`,
    index: 0,
  });

  assertEquals(res.ctx.index, res.ctx.text.length);
  assertEquals(res.success, true);
});
