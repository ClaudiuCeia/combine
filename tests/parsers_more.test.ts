import { assertEquals, assertObjectMatch } from "@std/assert";
import {
  anyChar,
  charWhere,
  eof,
  eol,
  hex,
  hexDigit,
  horizontalSpace,
  regex,
  signed,
  skipCharWhere,
  take,
  takeText,
} from "../src/parsers.ts";

Deno.test("anyChar fails at end of input", () => {
  const res = anyChar()({ text: "a", index: 1 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.expected, "reached end of input");
    assertEquals(res.ctx.index, 1);
  }
});

Deno.test("charWhere succeeds/fails based on predicate", () => {
  const ok = charWhere((code) => code === "A".charCodeAt(0))({
    text: "A",
    index: 0,
  });
  assertEquals(ok.success, true);
  if (ok.success) assertEquals(ok.value, "A");

  const bad = charWhere(() => false)({ text: "A", index: 0 });
  assertEquals(bad.success, false);
  if (!bad.success) {
    assertEquals(bad.expected.includes("failed the predicate"), true);
    assertEquals(bad.ctx.index, 1);
  }
});

Deno.test("skipCharWhere returns null when underlying charWhere matches", () => {
  const res = skipCharWhere(() => true)({ text: "Z", index: 0 });
  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, null);
    assertEquals(res.ctx.index, 1);
  }
});

Deno.test("take fails when count exceeds remaining input", () => {
  const res = take(3)({ text: "ab", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected, "unexpected end of input");
});

Deno.test("takeText consumes remainder", () => {
  assertObjectMatch(
    takeText()({ text: "hello", index: 2 }),
    { success: true, value: "llo", ctx: { index: 5 } },
  );
});

Deno.test("eol matches both LF and CRLF", () => {
  assertEquals(eol()({ text: "\n", index: 0 }).success, true);
  assertEquals(eol()({ text: "\r\n", index: 0 }).success, true);
});

Deno.test("eof fails when input remains", () => {
  const res = eof()({ text: "x", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected, "eof not reached");
});

Deno.test("horizontalSpace requires at least one space/tab", () => {
  assertEquals(horizontalSpace()({ text: " \tX", index: 0 }).success, true);
  assertEquals(horizontalSpace()({ text: "X", index: 0 }).success, false);
});

Deno.test("hexDigit matches 0-9 and A-F/a-f", () => {
  assertObjectMatch(hexDigit()({ text: "9", index: 0 }), {
    success: true,
    value: "9",
  });
  assertObjectMatch(hexDigit()({ text: "A", index: 0 }), {
    success: true,
    value: "A",
  });
  assertObjectMatch(hexDigit()({ text: "f", index: 0 }), {
    success: true,
    value: "f",
  });
});

Deno.test("hex rejects 0x lead", () => {
  const res = hex()({ text: "0xFF", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected, "unexpected 0x lead");
});

Deno.test("signed parses +/- numbers", () => {
  assertObjectMatch(signed()({ text: "+12", index: 0 }), {
    success: true,
    value: 12,
    ctx: { index: 3 },
  });
  assertObjectMatch(signed()({ text: "-12", index: 0 }), {
    success: true,
    value: -12,
    ctx: { index: 3 },
  });
});

Deno.test("regex does not search ahead from index", () => {
  const p = regex(/[0-9]+/, "number");
  const res = p({ text: "a1", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.ctx.index, 0);
});
