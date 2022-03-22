import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { forLoop, ifStatement } from "./control.ts";

Deno.test("if statements", () => {
  const statements = [
    `if (true) {        
      for (let i = 0; a <= a.length ;  i += 1) {
        b();
      }
      if (false) {
        b();
      }
    }`,
    `if (true) {
        print(a);
      } else {
        bar(42);
      }`,
    `if (true) {
        print(a);
      } else if (false) {
        bar(42);
      }`,
  ];

  for (const st of statements) {
    const res = ifStatement()({
      text: st,
      index: 0,
    });

    assertEquals(res.ctx.index, res.ctx.text.length);
    assertEquals(res.success, true);
  }

  const badStatements = [
    `if true {
        print(a);
      }`,
    `if (true) {
        print(a);
      } else (true) {
        bar(42);
      }`,
    `if (true) {
        print(a);
      } else if false {
        bar(42);
      }`,
  ];

  for (const st of badStatements) {
    const res = ifStatement()({
      text: st,
      index: 0,
    });

    assertEquals(res.success, false);
  }
});

Deno.test("for statements", () => {
  const ev = forLoop()({
    text: `for (let i = 0    /*foo*/ ; true  /*bar*/; i += 5 /*baz*/) {
      print(i);
      console.log(a);
      let a = 3.14;
      return 13;

      if (a) {
        b(c);

        for (let i = 0; true; i += 1) {
          b();
        }
        continue;
      }

      for (let i = 0; true; i += 1) {
        b();
        break;
      }

      for (let i = 0; true; i += 1) {
        b();
      }

      if (false) {
        return 1;
        for (let i = 0; true; i += 1) {
          b();
        }
      } else {
        b(1);
      }
    }`,
    index: 0,
  });

  // assertEquals(ev, {}, ev.ctx.text.slice(ev.ctx.index));
  assertEquals(ev.ctx.index, ev.ctx.text.length);
  assertEquals(ev.success, true);
});
