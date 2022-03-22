import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { kindName } from "./common.ts";
import { SyntaxKind } from "./SyntaxKind.ts";
import { program } from "./program.ts";

Deno.test(`SyntaxKind.${kindName(SyntaxKind.Program)}`, () => {
  const code = `
        match urn:user:[uuid] {
            function isOverAge(age) {
                let user = get(uuid);
                if (user.tenant == Tenant.ADMIN) {
                    return false;
                }

                return toYears(userbirthdate()) >= age;
            }

            allow: isOverAge(21);
            allow: request.user.uuid == uuid;
        }
    `;

  const res = program()({
    text: code,
    index: 0,
  });

  assertEquals(res.success, true);
});


Deno.test(`SyntaxKind.${kindName(SyntaxKind.Program)}`, () => {
  const code = `
        match urn:[entity]:[id] {
            function isOverAge(age) {
                let user = get(uuid);
                if (user.tenant == Tenant.ADMIN) {
                    return false;
                }

                return toYears(userbirthdate()) >= age;
            }

            allow: isOverAge(21);
            allow: request.user.uuid == uuid;
        }
    `;

  const res = program()({
    text: code,
    index: 0,
  });

  assertEquals(res.success, true);
});