import { assertEquals } from "@std/assert";
import { allMatches, furthestAll, seq } from "../src/combinators.ts";
import { str } from "../src/parsers.ts";
import { cut, map } from "../src/utility.ts";

Deno.test("furthestAll returns all matches at the furthest consumed index", () => {
  const p1 = map(str("a"), () => "p1");
  const p2 = map(str("ab"), () => "p2");
  const p3 = map(str("ab"), () => "p3");

  const res = furthestAll(p1, p2, p3)({ text: "ab", index: 0 });
  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.ctx.index, 2);
    assertEquals(res.value, ["p2", "p3"]);
  }
});

Deno.test("allMatches collects all successful matches and advances to the furthest success", () => {
  const quantity = map(str("20"), () => ({ kind: "quantity" as const, n: 20 }));
  const temperature = map(
    seq(str("20"), str(" degrees")),
    () => ({ kind: "temperature" as const, n: 20 }),
  );

  const res = allMatches(quantity, temperature)({
    text: "It's 20 degrees outside",
    index: 5,
  });
  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, [
      { kind: "quantity", n: 20 },
      { kind: "temperature", n: 20 },
    ]);
    assertEquals(res.ctx.index, 15); // "20 degrees" ends at index 15 from start of string
  }
});

Deno.test("furthestAll returns all matches when multiple parsers tie", () => {
  const p1 = map(str("a"), () => 1);
  const p2 = map(str("a"), () => 2);

  const res = furthestAll(p1, p2)({ text: "a", index: 0 });
  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.ctx.index, 1);
    assertEquals(res.value, [1, 2]);
  }
});

Deno.test("furthestAll returns the furthest failure when no parser matches", () => {
  const p1 = map(seq(str("a"), str("b")), () => "p1"); // fails at index 1 on "aX"
  const p2 = map(seq(str("a"), str("X"), str("Y")), () => "p2"); // fails at index 2 on "aXz"

  const res = furthestAll(p1, p2)({ text: "aXz", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.ctx.index, 2);
    assertEquals(res.expected, "Y");
  }
});

Deno.test("furthestAll propagates fatal failures immediately", () => {
  let secondTried = false;
  const fatal = cut(str("a"), "a");
  const other = map(str("b"), () => {
    secondTried = true;
    return "b";
  });

  const res = furthestAll(fatal, other)({ text: "b", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.fatal, true);
    assertEquals(res.expected, "a");
  }
  assertEquals(secondTried, false);
});
