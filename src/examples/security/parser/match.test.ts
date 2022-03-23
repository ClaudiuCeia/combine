import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { matchExpression, pattern } from "./match.ts";

Deno.test("match expression", () => {
  const res = matchExpression({
    text: `match foo {
            function foo(age, foo ) /*foo*/ {
                let user = get(uuid);
                if (user.tenant == Tenant.ADMIN) {
                    return false;
                }

                return toYears(user.birthdate) - age;
            }

            allow read: false;
        }`,
    index: 0,
  });

  console.log(res);
  // console.log();
  assertEquals(res.success, true, res.ctx.text.slice(res.ctx.index));
});

Deno.test("pattern", () => {
  const patterns = [
    `foo`,
    `foo:[bar]`,
    `foo:[bar]:[baz]`,
    `foo:[bar]:baz`,
    `foo:[bar]:[baz]:barz`,
  ];

  for (const patt of patterns) {
    const res = pattern({
      text: patt,
      index: 0,
    });

    assertEquals(res.ctx.index, res.ctx.text.length);
    assertEquals(res.success, true);
  }
});
