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
import { any, many, manyTill, optional } from "../src/combinators.ts";
import {
  anyChar,
  eof,
  notChar,
  regex,
  str,
  take,
  takeText,
  trie,
} from "../src/parsers.ts";

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

describe("streaming strings", () => {
  test("suspend while input is a strict prefix", () => {
    const stream = createStreamingParser(str("hello"));

    expect(stream.feed("hel")).toMatchObject({
      success: false,
      pending: true,
      expected: "hello",
    });
    expect(stream.feed("lo")).toMatchObject({
      success: true,
      value: "hello",
      ctx: { index: 5 },
    });
  });

  test("fail as soon as an existing character mismatches", () => {
    const result = createStreamingParser(str("hello")).feed("help");
    expect(result).toMatchObject({ success: false, expected: "hello" });
    expect(isPending(result)).toBe(false);
  });

  test("preserve finite parsing and empty matches", () => {
    expect(str("hello")({ text: "hel", index: 0 })).toMatchObject({
      success: false,
      expected: "hello",
    });
    expect(str("")({ text: "", index: 0, final: false })).toMatchObject({
      success: true,
      value: "",
    });
  });
});

describe("streaming characters", () => {
  test("anyChar suspends only at an open boundary", () => {
    const stream = createStreamingParser(anyChar());

    expect(stream.feed("")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("a")).toMatchObject({
      success: true,
      value: "a",
      ctx: { index: 1, final: false },
    });
  });

  test("anyChar preserves final EOF failure", () => {
    expect(createStreamingParser(anyChar()).finish()).toMatchObject({
      success: false,
      expected: "reached end of input",
    });
  });

  test("notChar suspends at an open boundary", () => {
    const stream = createStreamingParser(notChar("\n".charCodeAt(0)));

    expect(stream.feed("")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("a")).toMatchObject({ success: true, value: "a" });
  });

  test("notChar keeps exclusions definitive", () => {
    const result = createStreamingParser(notChar("\n".charCodeAt(0))).feed(
      "\n",
    );

    expect(result).toMatchObject({
      success: false,
      expected: 'found char "\n"',
    });
    expect(isPending(result)).toBe(false);
  });
});

describe("streaming fixed-width input", () => {
  test("take suspends until enough input is buffered", () => {
    const stream = createStreamingParser(take(5));

    expect(stream.feed("hel")).toMatchObject({
      success: false,
      pending: true,
      expected: "5 characters",
    });
    expect(stream.feed("lo!")).toMatchObject({
      success: true,
      value: "hello",
      ctx: { index: 5 },
    });
  });

  test("take preserves final EOF diagnostics", () => {
    const stream = createStreamingParser(take(5));
    expect(stream.feed("hel")).toMatchObject({ pending: true });
    expect(stream.finish()).toMatchObject({
      success: false,
      expected: "unexpected end of input",
    });
  });
});

describe("streaming remaining input", () => {
  test("takeText waits until the stream is finalized", () => {
    const stream = createStreamingParser(takeText());

    expect(stream.feed("hel")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("lo")).toMatchObject({ success: false, pending: true });
    expect(stream.finish()).toMatchObject({ success: true, value: "hello" });
  });
});

describe("streaming end of input", () => {
  test("eof waits for explicit finalization", () => {
    const stream = createStreamingParser(eof());

    expect(stream.feed("")).toMatchObject({ success: false, pending: true });
    expect(stream.finish()).toMatchObject({ success: true, value: null });
  });

  test("eof fails definitively when input remains", () => {
    const result = createStreamingParser(eof()).feed("x");
    expect(result).toMatchObject({
      success: false,
      expected: "eof not reached",
    });
    expect(isPending(result)).toBe(false);
  });
});

describe("streaming tries", () => {
  test("wait for a possible longer match", () => {
    const stream = createStreamingParser(trie(["`", "```"]));

    expect(stream.feed("`")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("``")).toMatchObject({ success: true, value: "```" });
  });

  test("commit the shorter match after a mismatch", () => {
    expect(createStreamingParser(trie(["=", "=="])).feed("=x")).toMatchObject({
      success: true,
      value: "=",
    });
  });

  test("fail partial prefixes when input is final", () => {
    const stream = createStreamingParser(trie(["```"]));
    expect(stream.feed("``")).toMatchObject({ success: false, pending: true });
    expect(stream.finish()).toMatchObject({
      success: false,
      expected: "one of ```",
    });
  });
});

describe("streaming regular expressions", () => {
  test("generic regex waits for final input", () => {
    const stream = createStreamingParser(regex(/[a-z]+/, "identifier"));

    expect(stream.feed("name ")).toMatchObject({
      success: false,
      pending: true,
      expected: "identifier",
    });
    expect(stream.finish()).toMatchObject({ success: true, value: "name" });
  });

  test("end-sensitive expressions cannot succeed prematurely", () => {
    const stream = createStreamingParser(regex(/a(?=b$)/, "a before final b"));

    expect(stream.feed("ab")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("c")).toMatchObject({ success: false, pending: true });
    expect(stream.finish()).toMatchObject({
      success: false,
      expected: "a before final b",
    });
  });
});

describe("streaming ordered choice", () => {
  test("waits for an earlier ambiguous alternative", () => {
    const stream = createStreamingParser(any(str("ab"), str("a")));

    expect(stream.feed("a")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("b")).toMatchObject({ success: true, value: "ab" });
  });

  test("tries later alternatives after definitive failures", () => {
    expect(
      createStreamingParser(any(str("x"), str("ab"))).feed("ab"),
    ).toMatchObject({ success: true, value: "ab" });
  });
});

describe("streaming optional values", () => {
  test("do not treat incomplete input as absence", () => {
    const stream = createStreamingParser(optional(str("ab")));

    expect(stream.feed("a")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("b")).toMatchObject({ success: true, value: "ab" });
  });

  test("remain absent after a definitive mismatch", () => {
    expect(createStreamingParser(optional(str("ab"))).feed("x")).toMatchObject({
      success: true,
      value: null,
    });
  });
});

describe("streaming repetitions", () => {
  test("wait for an incomplete repeated value", () => {
    const stream = createStreamingParser(many(str("ab")));

    expect(stream.feed("aba")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("bx")).toMatchObject({
      success: true,
      value: ["ab", "ab"],
      ctx: { index: 4 },
    });
  });

  test("finish repetition at final input", () => {
    const stream = createStreamingParser(many(str("ab")));
    expect(stream.feed("abab")).toMatchObject({
      success: false,
      pending: true,
    });
    expect(stream.finish()).toMatchObject({
      success: true,
      value: ["ab", "ab"],
    });
  });
});

describe("streaming terminated repetitions", () => {
  test("wait for a closing fence split across chunks", () => {
    const stream = createStreamingParser(manyTill(anyChar(), str("```")));

    expect(stream.feed("const x = 1;\n`")).toMatchObject({
      success: false,
      pending: true,
    });
    expect(stream.feed("``")).toMatchObject({
      success: true,
      value: [..."const x = 1;\n", "```"],
    });
  });

  test("turn an unfinished fence into a final failure", () => {
    const stream = createStreamingParser(manyTill(anyChar(), str("```")));

    expect(stream.feed("body\n``")).toMatchObject({
      success: false,
      pending: true,
    });
    expect(stream.finish()).toMatchObject({ success: false, expected: "```" });
  });
});
