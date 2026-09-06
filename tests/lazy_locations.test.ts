import { expect, test } from "bun:test";
import { many } from "../src/combinators.ts";
import { failure, getLocation, pending, pushFrame } from "../src/Parser.ts";
import { createLocationSession, withLocationSession } from "../src/internal.ts";
import { str } from "../src/parsers.ts";

test("failure locations resolve lazily without changing their shape", () => {
  const result = failure(
    { text: `${"x".repeat(70_000)}\ndef`, index: 70_002 },
    "value",
  );

  expect(Object.keys(result.location)).toEqual(["line", "column"]);
  expect(
    typeof Object.getOwnPropertyDescriptor(result.location, "line")?.get,
  ).toBe("function");

  const copy = { ...result };
  expect(copy.location).toBe(result.location);

  expect(result.location).toEqual({ line: 2, column: 2 });
  expect(Object.keys(result.location)).toEqual(["line", "column"]);
  expect(JSON.parse(JSON.stringify(result))).toMatchObject({
    location: { line: 2, column: 2 },
  });

  const denseResult = failure(
    { text: "\n".repeat(10_000), index: 9_999 },
    "value",
  );
  expect(
    typeof Object.getOwnPropertyDescriptor(denseResult.location, "line")?.get,
  ).toBe("function");
  expect(denseResult.location).toEqual({ line: 10_000, column: 1 });
});

test("small unscoped locations preserve their plain data shape", () => {
  const result = failure({ text: "a\nb", index: 2 }, "value");

  expect(
    Object.getOwnPropertyDescriptor(result.location, "line"),
  ).toMatchObject({ value: 2 });
  expect(result.location).toEqual({ line: 2, column: 1 });
});

test("pending and stack frame locations use session indexing", () => {
  const pendingSession = createLocationSession();
  const pendingResult = withLocationSession(pendingSession, () =>
    pending({ text: "a\nb", index: 2, final: false }, "more input"),
  );

  expect(pendingSession.scannedTo).toBe(2);
  expect(pendingResult.location.column).toBe(1);
  expect(pendingSession.scannedTo).toBe(2);

  const frameSession = createLocationSession();
  const framed = withLocationSession(frameSession, () =>
    pushFrame(failure({ text: "a\nbc\ndef", index: 7 }, "value"), "in item", {
      text: "a\nbc\ndef",
      index: 2,
    }),
  );

  expect(frameSession.scannedTo).toBe(7);
  expect(framed.stack[0]!.location).toEqual({ line: 2, column: 1 });
  expect(frameSession.scannedTo).toBe(7);
  expect(framed.location).toEqual({ line: 3, column: 3 });
  expect(frameSession.scannedTo).toBe(7);
});

test("ordinary swallowed mismatches do not scan for locations", () => {
  const session = createLocationSession();
  const parser = many(str("a"));

  const result = withLocationSession(session, () =>
    parser({ text: "not an a", index: 0 }),
  );

  expect(result).toMatchObject({ success: true, value: [] });
  expect(session.scannedTo).toBe(0);
});

test("location sessions incrementally scan growing input in constant space", () => {
  const session = createLocationSession();

  expect(
    withLocationSession(session, () => getLocation({ text: "a\n", index: 2 })),
  ).toEqual({ line: 2, column: 1 });
  expect(session).toEqual({ scannedTo: 2, line: 2, lineStart: 2 });

  expect(
    withLocationSession(session, () =>
      getLocation({ text: "a\nb\n", index: 4 }),
    ),
  ).toEqual({ line: 3, column: 1 });
  expect(session).toEqual({ scannedTo: 4, line: 3, lineStart: 4 });

  expect(
    withLocationSession(session, () => getLocation({ text: "a\n", index: 1 })),
  ).toEqual({ line: 1, column: 2 });
  expect(session).toEqual({ scannedTo: 4, line: 3, lineStart: 4 });
  expect(Object.keys(session)).toEqual(["scannedTo", "line", "lineStart"]);
});
