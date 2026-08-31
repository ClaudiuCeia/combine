import { describe, expect, test } from "bun:test";
import {
  failure,
  isPending,
  pending,
  type Parser,
  success,
  type Result,
} from "../src/Parser.ts";
import { createStreamingParser } from "../src/streaming.ts";

describe("pending parser results", () => {
  test("are distinguishable from definitive failures", () => {
    const ctx = { text: "ab", index: 2, final: false } as const;
    const result: Result<string> = pending(ctx, "more input");

    expect(result.success).toBe(false);
    expect(isPending(result)).toBe(true);
    expect(result).toMatchObject({
      pending: true,
      expected: "more input",
      fatal: false,
      ctx,
    });
  });

  test("do not change finite success and failure shapes", () => {
    const ctx = { text: "x", index: 0 } as const;

    expect(Object.keys(success(ctx, "x"))).toEqual(["success", "value", "ctx"]);
    expect(Object.keys(failure(ctx, "value"))).toEqual([
      "success",
      "expected",
      "ctx",
      "location",
      "variants",
      "stack",
      "fatal",
    ]);
  });

  test("ordinary failures are not pending", () => {
    expect(isPending(failure({ text: "x", index: 0 }, "value"))).toBe(false);
  });
});

describe("buffered parser sessions", () => {
  const waitsForFinal: Parser<string> = (ctx) =>
    ctx.final === false ? pending(ctx, "final input") : success(ctx, ctx.text);

  test("feeds accumulated text and finalizes it", () => {
    const stream = createStreamingParser(waitsForFinal);

    const first = stream.feed("hel");
    expect(isPending(first)).toBe(true);
    expect(stream.done).toBe(false);

    const second = stream.feed("lo");
    expect(isPending(second)).toBe(true);

    const result = stream.finish();
    expect(result).toMatchObject({ success: true, value: "hello" });
    expect(stream.done).toBe(true);
    expect(stream.finish()).toBe(result);
  });

  test("supports finalizing empty input", () => {
    const result = createStreamingParser(waitsForFinal).finish();
    expect(result).toMatchObject({ success: true, value: "" });
  });

  test("stops after an early definitive result", () => {
    const stream = createStreamingParser<string>((ctx) =>
      failure(ctx, "definitive failure"),
    );

    expect(stream.feed("x")).toMatchObject({
      success: false,
      expected: "definitive failure",
    });
    expect(stream.done).toBe(true);
    expect(() => stream.feed("y")).toThrow(
      "cannot feed a completed streaming parser",
    );
  });

  test("turns invalid final pending results into failures", () => {
    const stream = createStreamingParser<string>((ctx) =>
      pending(ctx, "a terminal result"),
    );

    expect(stream.finish()).toMatchObject({
      success: false,
      expected: "a terminal result",
      fatal: false,
    });
  });
});
