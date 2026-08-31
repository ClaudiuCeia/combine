import { assertEquals, assertObjectMatch } from "@std/assert";
import { many, repeat } from "../src/combinators.ts";
import { formatErrorCompact } from "../src/Parser.ts";
import {
  anyChar,
  charWhere,
  digit,
  eof,
  eol,
  hex,
  hexDigit,
  horizontalSpace,
  letter,
  notChar,
  regex,
  signed,
  skipCharWhere,
  space,
  take,
  takeText,
} from "../src/parsers.ts";

Deno.test("digit, letter, and space parsers are reusable", () => {
  const digitParser = digit();
  const letterParser = letter();
  const spaceParser = space();

  assertObjectMatch(digitParser({ text: "a7", index: 1 }), {
    success: true,
    value: 7,
    ctx: { index: 2 },
  });
  assertEquals(digitParser({ text: "x", index: 0 }).success, false);
  assertObjectMatch(digitParser({ text: "3", index: 0 }), {
    success: true,
    value: 3,
    ctx: { index: 1 },
  });

  assertObjectMatch(letterParser({ text: "1Z", index: 1 }), {
    success: true,
    value: "Z",
    ctx: { index: 2 },
  });
  assertEquals(letterParser({ text: "_", index: 0 }).success, false);
  assertObjectMatch(letterParser({ text: "q", index: 0 }), {
    success: true,
    value: "q",
    ctx: { index: 1 },
  });

  assertObjectMatch(spaceParser({ text: "x \t\n", index: 1 }), {
    success: true,
    value: " \t\n",
    ctx: { index: 4 },
  });
  assertEquals(spaceParser({ text: "x", index: 0 }).success, false);
  assertObjectMatch(spaceParser({ text: "\r", index: 0 }), {
    success: true,
    value: "\r",
    ctx: { index: 1 },
  });
});

Deno.test("anyChar fails at end of input", () => {
  for (const index of [1, 2]) {
    const res = anyChar()({ text: "a", index });
    assertEquals(res.success, false);
    if (!res.success) {
      assertEquals(res.expected, "reached end of input");
      assertEquals(res.ctx.index, index);
    }
  }
});

Deno.test("notChar fails at and beyond end of input", () => {
  for (const index of [1, 2]) {
    const res = notChar(34)({ text: "a", index });
    assertEquals(res.success, false);
    if (!res.success) assertEquals(res.ctx.index, index);
  }
});

Deno.test("many notChar terminates at end of input", () => {
  assertObjectMatch(many(notChar(34))({ text: "abc", index: 0 }), {
    success: true,
    value: ["a", "b", "c"],
    ctx: { index: 3 },
  });
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
    assertEquals(bad.ctx.index, 0);
  }

  assertEquals(charWhere(() => true)({ text: "\n", index: 0 }).success, true);
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

Deno.test("take and repeat reject invalid counts", () => {
  for (const count of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const takeRes = take(count)({ text: "abc", index: 0 });
    assertEquals(takeRes.success, false);
    if (!takeRes.success) {
      assertEquals(
        takeRes.expected.includes("non-negative safe integer"),
        true,
      );
    }

    const repeatRes = repeat(count, anyChar())({ text: "abc", index: 0 });
    assertEquals(repeatRes.success, false);
    if (!repeatRes.success) {
      assertEquals(
        repeatRes.expected.includes("non-negative safe integer"),
        true,
      );
    }
  }

  assertObjectMatch(repeat(0, anyChar())({ text: "abc", index: 0 }), {
    success: true,
    value: [],
    ctx: { index: 0 },
  });
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

Deno.test("horizontalSpace rejects LF and CRLF", () => {
  for (const lineEnding of ["\n", "\r\n"]) {
    const rejected = horizontalSpace()({ text: lineEnding, index: 0 });
    assertEquals(rejected.success, false);
    if (!rejected.success) assertEquals(rejected.ctx.index, 0);

    const stopped = horizontalSpace()({ text: ` \t${lineEnding}`, index: 0 });
    assertEquals(stopped.success, true);
    if (stopped.success) assertEquals(stopped.ctx.index, 2);
  }
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

Deno.test("hex parses contiguous digits without commas", () => {
  const res = hex()({ text: "FF", index: 0 });
  assertEquals(res.success, true);
  if (res.success) {
    assertEquals(res.value, "FF");
    assertEquals(res.ctx.index, 2);
  }
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

Deno.test("primitive expectations format without duplicate prefixes", () => {
  for (const parser of [digit(), letter(), space()]) {
    const res = parser({ text: "!", index: 0 });
    assertEquals(res.success, false);
    if (!res.success) {
      assertEquals(
        formatErrorCompact(res).startsWith("expected expected"),
        false,
      );
    }
  }
});
