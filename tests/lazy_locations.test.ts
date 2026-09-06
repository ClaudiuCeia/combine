import { expect, test } from "bun:test";
import {
  type ErrorFrame,
  type Failure,
  getLocation,
  type SourceLocation,
  type WithSpan,
} from "../mod.ts";
import { any, many, seq } from "../src/combinators.ts";
import {
  failure,
  pending,
  pushFrame,
  runParser,
  success,
  type Context,
} from "../src/Parser.ts";
import { createLocationSession, withLocationSession } from "../src/internal.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;
type ExpectedLocation = Readonly<{ line: number; column: number }>;
type _SourceLocationIsReadonly = Assert<
  Equal<SourceLocation, ExpectedLocation>
>;
type _GetLocationIsReadonly = Assert<
  Equal<ReturnType<typeof getLocation>, ExpectedLocation>
>;
type _FailureLocationIsReadonly = Assert<
  Equal<Failure["location"], ExpectedLocation>
>;
type _FrameLocationIsReadonly = Assert<
  Equal<ErrorFrame["location"], ExpectedLocation>
>;
type _SpanStartIsReadonly = Assert<
  Equal<WithSpan<unknown>["locationStart"], ExpectedLocation>
>;
type _SpanEndIsReadonly = Assert<
  Equal<WithSpan<unknown>["locationEnd"], ExpectedLocation>
>;

test("oversized unscoped locations are detached snapshots", () => {
  const location = (() =>
    failure({ text: `${"x".repeat(70_000)}\ndef`, index: 70_002 }, "value")
      .location)();

  expect(Reflect.ownKeys(location)).toEqual(["line", "column"]);
  expect(Object.getOwnPropertyDescriptors(location)).toEqual({
    line: {
      value: 2,
      writable: true,
      enumerable: true,
      configurable: true,
    },
    column: {
      value: 2,
      writable: true,
      enumerable: true,
      configurable: true,
    },
  });
  expect(location).toEqual({ line: 2, column: 2 });
  expect(JSON.parse(JSON.stringify(location))).toEqual({ line: 2, column: 2 });

  const denseResult = failure(
    { text: "\n".repeat(10_000), index: 9_999 },
    "value",
  );
  expect(
    Object.getOwnPropertyDescriptor(denseResult.location, "line"),
  ).toMatchObject({ value: 10_000 });
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
  const pendingResult = withLocationSession(pendingSession, "a\nb", () =>
    pending({ text: "a\nb", index: 2, final: false }, "more input"),
  );

  expect(pendingSession.scannedTo).toBe(2);
  expect(pendingResult.location.column).toBe(1);
  expect(pendingSession.scannedTo).toBe(2);

  const frameSession = createLocationSession();
  const framed = withLocationSession(frameSession, "a\nbc\ndef", () =>
    pushFrame(failure({ text: "a\nbc\ndef", index: 7 }, "value"), "in item", {
      text: "a\nbc\ndef",
      index: 2,
    }),
  );

  expect(frameSession.scannedTo).toBe(7);
  expect(framed.stack).toEqual([
    { label: "in item", location: { line: 2, column: 1 } },
  ]);
  expect(frameSession.scannedTo).toBe(7);
  expect(framed.location).toEqual({ line: 3, column: 3 });
  expect(frameSession.scannedTo).toBe(7);
});

test("swallowed mismatches compute nonzero locations once", () => {
  const text = "prefix!";
  const inspectedIndexes: number[] = [];
  const source = {
    length: text.length,
    charCodeAt: (index: number) => {
      inspectedIndexes.push(index);
      return text.charCodeAt(index);
    },
  } as string;
  const session = createLocationSession();
  let swallowed: ReturnType<typeof failure> | undefined;
  const parser = seq(
    (ctx: Context) => success({ ...ctx, index: 6 }, "prefix"),
    many((ctx) => {
      swallowed = failure(ctx, "a");
      return swallowed;
    }),
  );

  const result = withLocationSession(session, source, () =>
    parser({ text: source, index: 0 }),
  );

  expect(result).toMatchObject({
    success: true,
    value: ["prefix", []],
    ctx: { index: 6 },
  });
  expect(swallowed?.location).toEqual({ line: 1, column: 7 });
  expect(inspectedIndexes).toEqual([0, 1, 2, 3, 4, 5]);
  expect(session.scannedTo).toBe(6);
});

test("location sessions incrementally scan growing input in constant space", () => {
  const session = createLocationSession();

  expect(
    withLocationSession(session, "a\n", () =>
      getLocation({ text: "a\n", index: 2 }),
    ),
  ).toEqual({ line: 2, column: 1 });
  expect(session).toEqual({
    sourceLength: 2,
    scannedTo: 2,
    line: 2,
    lineStart: 2,
    reverseTo: 2,
    reverseLine: 2,
    reverseLineStart: 2,
  });

  expect(
    withLocationSession(session, "a\nb\n", () =>
      getLocation({ text: "a\nb\n", index: 4 }),
    ),
  ).toEqual({ line: 3, column: 1 });
  expect(session).toEqual({
    sourceLength: 4,
    scannedTo: 4,
    line: 3,
    lineStart: 4,
    reverseTo: 4,
    reverseLine: 3,
    reverseLineStart: 4,
  });

  expect(
    withLocationSession(session, "a\nb\n", () =>
      getLocation({ text: "a\nb\n", index: 1 }),
    ),
  ).toEqual({ line: 1, column: 2 });
  expect(session).toEqual({
    sourceLength: 4,
    scannedTo: 4,
    line: 3,
    lineStart: 4,
    reverseTo: 1,
    reverseLine: 1,
    reverseLineStart: 0,
  });
  expect(Object.keys(session)).toEqual([
    "sourceLength",
    "scannedTo",
    "line",
    "lineStart",
    "reverseTo",
    "reverseLine",
    "reverseLineStart",
  ]);
});

test("location sessions reset when input shrinks", () => {
  const session = createLocationSession();
  const longSource = "x\n".repeat(100);

  withLocationSession(session, longSource, () =>
    getLocation({ text: longSource, index: longSource.length }),
  );
  const location = withLocationSession(session, "a\n", () =>
    getLocation({ text: "a\n", index: 1 }),
  );

  expect(location).toEqual({ line: 1, column: 2 });
  expect(session).toEqual({
    sourceLength: 2,
    scannedTo: 1,
    line: 1,
    lineStart: 0,
    reverseTo: 1,
    reverseLine: 1,
    reverseLineStart: 0,
  });
});

test("alternatives scan decreasing diagnostic positions in reverse", () => {
  const source = "a\nbc\n\ndef";
  const session = createLocationSession();
  const diagnostics: ReturnType<typeof failure>[] = [];
  const parser = any(
    ...[9, 6, 5, 4, 2, 1].map((index) => (ctx: Context) => {
      const diagnostic = failure({ ...ctx, index }, `position ${index}`);
      diagnostics.push(diagnostic);
      return diagnostic;
    }),
  );

  const result = withLocationSession(session, source, () =>
    parser({ text: source, index: 0 }),
  );

  expect(result).toMatchObject({ success: false, ctx: { index: 9 } });
  expect(diagnostics.map(({ location }) => location)).toEqual([
    { line: 4, column: 4 },
    { line: 4, column: 1 },
    { line: 3, column: 1 },
    { line: 2, column: 3 },
    { line: 2, column: 1 },
    { line: 1, column: 2 },
  ]);
  expect(session).toEqual({
    sourceLength: 9,
    scannedTo: 9,
    line: 4,
    lineStart: 6,
    reverseTo: 1,
    reverseLine: 1,
    reverseLineStart: 0,
  });
});

test("location sessions restart reverse scans for growing-input passes", () => {
  const session = createLocationSession();
  const firstText = "x\n".repeat(100);
  const firstSource = {
    length: firstText.length,
    charCodeAt: (index: number) => firstText.charCodeAt(index),
  } as string;

  withLocationSession(session, firstSource, () => {
    for (let index = firstText.length; index > 0; index -= 2) {
      failure({ text: firstSource, index }, "value");
    }
  });

  const secondText = `${firstText}x\n`;
  let inspectedCodeUnits = 0;
  const secondSource = {
    length: secondText.length,
    charCodeAt: (index: number) => {
      inspectedCodeUnits++;
      return secondText.charCodeAt(index);
    },
  } as string;

  withLocationSession(session, secondSource, () => {
    for (let index = firstText.length - 2; index > 0; index -= 2) {
      failure({ text: secondSource, index }, "value");
    }
  });

  expect(inspectedCodeUnits).toBe(firstText.length - 2);
});

test("high-water lookups preserve reverse scan progress", () => {
  const text = "a\nbc\n\ndef";
  let inspectedCodeUnits = 0;
  const source = {
    length: text.length,
    charCodeAt: (index: number) => {
      inspectedCodeUnits++;
      return text.charCodeAt(index);
    },
  } as string;
  const session = createLocationSession();

  const locations = withLocationSession(session, source, () =>
    [9, 2, 9, 1].map((index) => getLocation({ text: source, index })),
  );

  expect(locations).toEqual([
    { line: 4, column: 4 },
    { line: 2, column: 1 },
    { line: 4, column: 4 },
    { line: 1, column: 2 },
  ]);
  expect(inspectedCodeUnits).toBe(14);
  expect(session.reverseTo).toBe(1);
});

test("location sessions scan CRLF input backwards by UTF-16 offset", () => {
  const source = "a\r\nb";
  const session = createLocationSession();

  const locations = withLocationSession(session, source, () =>
    [4, 3, 2, 1, 0].map((index) => getLocation({ text: source, index })),
  );

  expect(locations).toEqual([
    { line: 2, column: 2 },
    { line: 2, column: 1 },
    { line: 1, column: 3 },
    { line: 1, column: 2 },
    { line: 1, column: 1 },
  ]);
});

test("location sessions isolate diagnostics from another source", () => {
  let foreignFailure: ReturnType<typeof failure> | undefined;
  let foreignPending: ReturnType<typeof pending> | undefined;
  let foreignFrame: ReturnType<typeof failure> | undefined;

  const result = runParser((ctx) => {
    const primary = failure({ ...ctx, index: 4 }, "primary");
    const foreignCtx = { text: "xxxx\ny", index: 6 };
    foreignFailure = failure(foreignCtx, "foreign");
    foreignPending = pending({ ...foreignCtx, final: false }, "foreign");
    foreignFrame = pushFrame(primary, "in foreign source", foreignCtx);
    return success(ctx, null);
  }, "a\nb\nc");

  expect(result).toEqual(success({ text: "a\nb\nc", index: 0 }, null));
  expect(foreignFailure?.location).toEqual({ line: 2, column: 2 });
  expect(foreignPending?.location).toEqual({ line: 2, column: 2 });
  expect(foreignFrame?.stack).toEqual([
    { label: "in foreign source", location: { line: 2, column: 2 } },
  ]);
});

test("nested location sessions restore the outer source", () => {
  const outerSession = createLocationSession();
  let outerLocation: ReturnType<typeof getLocation> | undefined;

  withLocationSession(outerSession, "a\nb\nc", () => {
    getLocation({ text: "a\nb\nc", index: 4 });

    const innerResult = runParser(
      (innerCtx) => failure({ ...innerCtx, index: 6 }, "inner"),
      "xxxx\ny",
    );
    expect(innerResult.success).toBe(false);

    outerLocation = getLocation({ text: "a\nb\nc", index: 5 });
  });

  expect(outerLocation).toEqual({ line: 3, column: 2 });
  expect(outerSession).toEqual({
    sourceLength: 5,
    scannedTo: 5,
    line: 3,
    lineStart: 4,
    reverseTo: 5,
    reverseLine: 3,
    reverseLineStart: 4,
  });
});

test("location sessions restore the previous source after exceptions", () => {
  const outerSession = createLocationSession();
  const innerSession = createLocationSession();

  withLocationSession(outerSession, "a\nb", () => {
    getLocation({ text: "a\nb", index: 1 });

    expect(() =>
      withLocationSession(innerSession, "x\ny", () => {
        getLocation({ text: "x\ny", index: 2 });
        throw new Error("inner failed");
      }),
    ).toThrow("inner failed");

    expect(getLocation({ text: "a\nb", index: 3 })).toEqual({
      line: 2,
      column: 2,
    });
  });

  expect(outerSession).toEqual({
    sourceLength: 3,
    scannedTo: 3,
    line: 2,
    lineStart: 2,
    reverseTo: 3,
    reverseLine: 2,
    reverseLineStart: 2,
  });
  expect(innerSession).toEqual({
    sourceLength: 3,
    scannedTo: 2,
    line: 2,
    lineStart: 2,
    reverseTo: 2,
    reverseLine: 2,
    reverseLineStart: 2,
  });
});
