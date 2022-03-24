import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { program } from "./program.ts";

Deno.test("program test", () => {
  const code = `
        match urn:user:[uuid] {
            function isOverAge(age) {
                let user = get(uuid);
                if (user.tenant == Tenant.ADMIN) {
                    return false;
                }

                return toYears(userbirthdate()) >= age;
            }

            allow read: isOverAge(21);
            allow write: request.user.uuid == uuid;
        }
    `;

  const res = program()({
    text: code,
    index: 0,
  });

  // console.log(res);
  // console.log(JSON.stringify((res as any).value));
  assertEquals(res.ctx.text.length, res.ctx.index);
  assertEquals(res.success, true);
});
