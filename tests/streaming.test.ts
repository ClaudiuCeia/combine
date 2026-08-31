import { describe, expect, test } from "bun:test";
import {
  failure,
  isPending,
  pending,
  type Parser,
  success,
  type Result,
} from "../src/Parser.ts";
import {
  createStreamingParser,
  parseStream,
  parseStreamEach,
} from "../src/streaming.ts";
import {
  allMatches,
  any,
  chainl1,
  chainr1,
  many,
  manyTill,
  minus,
  not,
  oneOf,
  optional,
  peek,
  sepBy,
  furthest,
  furthestAll,
  seq,
} from "../src/combinators.ts";
import {
  anyChar,
  digit,
  double,
  eof,
  letter,
  notChar,
  number,
  regex,
  space,
  str,
  take,
  takeText,
  trie,
} from "../src/parsers.ts";
import { cut, ifPeek, onFailure, peekAnd } from "../src/utility.ts";
import { blockComment, keyword, lineComment } from "../src/lexer.ts";
import { recognizeAt, step } from "../src/nondeterministic.ts";

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

  test("primitive successes preserve an explicit final marker", () => {
    const cases: [Parser<unknown>, string][] = [
      [str("a"), "a"],
      [trie(["a"]), "a"],
      [anyChar(), "a"],
      [take(1), "a"],
      [takeText(), "a"],
      [regex(/a/, "a"), "a"],
    ];

    for (const [parser, text] of cases) {
      expect(parser({ text, index: 0, final: true })).toMatchObject({
        success: true,
        ctx: { final: true },
      });
    }
  });

  test("final-aware parsers compose after primitive successes", () => {
    const finalOnly: Parser<null> = (ctx) =>
      ctx.final === true ? success(ctx, null) : pending(ctx, "final input");
    const stream = createStreamingParser(seq(str("a"), finalOnly));

    expect(stream.feed("a")).toMatchObject({ success: false, pending: true });
    expect(stream.finish()).toMatchObject({ success: true });
  });

  test("combinators restore finality erased by existing wrappers", () => {
    const legacy = <T>(parser: Parser<T>): Parser<T> => {
      return (ctx) => parser({ text: ctx.text, index: ctx.index });
    };
    const stream = createStreamingParser(seq(legacy(str("a")), str("bc")));

    expect(stream.feed("ab")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("c")).toMatchObject({
      success: true,
      value: ["a", "bc"],
    });
  });

  test("repetition restores finality between wrapped matches", () => {
    const legacyA: Parser<string> = (ctx) => {
      const result = str("a")(ctx);
      return result.success
        ? success(
            { text: result.ctx.text, index: result.ctx.index },
            result.value,
          )
        : result;
    };
    const stream = createStreamingParser(many(legacyA));

    expect(stream.feed("a")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("!")).toMatchObject({ success: true, value: ["a"] });
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

describe("async parser streams", () => {
  test("resolve nullable parsers before pulling a chunk", async () => {
    let pulls = 0;
    async function* chunks(): AsyncGenerator<string> {
      pulls++;
      yield "unused";
    }

    const results: Result<string>[] = [];
    for await (const result of parseStream(str(""), chunks())) {
      results.push(result);
    }

    expect(pulls).toBe(0);
    expect(results).toEqual([
      success({ text: "", index: 0, final: false }, ""),
    ]);
  });

  test("yield pending states followed by the terminal result", async () => {
    async function* chunks(): AsyncGenerator<string> {
      yield "";
      yield "hel";
      yield "lo";
    }

    const results: Result<string>[] = [];
    for await (const result of parseStream(str("hello"), chunks())) {
      results.push(result);
    }

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ success: false, pending: true });
    expect(results[1]).toMatchObject({ success: true, value: "hello" });
  });

  test("finalize an incomplete source", async () => {
    async function* chunks(): AsyncGenerator<string> {
      yield "hel";
    }

    const results: Result<string>[] = [];
    for await (const result of parseStream(str("hello"), chunks())) {
      results.push(result);
    }

    expect(results).toHaveLength(2);
    expect(results[1]).toMatchObject({ success: false, expected: "hello" });
    expect(isPending(results[1]!)).toBe(false);
  });

  test("yield consecutive values from the same source", async () => {
    async function* chunks(): AsyncGenerator<string> {
      yield "a";
      yield "ba";
      yield "b";
    }

    const results: Result<string>[] = [];
    for await (const result of parseStreamEach(str("ab"), chunks())) {
      results.push(result);
    }

    expect(
      results
        .filter((result) => result.success)
        .map((result) => (result.success ? result.value : null)),
    ).toEqual(["ab", "ab"]);
    expect(results.filter(isPending)).toHaveLength(2);
  });

  test("release consumed input between repeated-value batches", async () => {
    const contexts: { text: string; index: number }[] = [];
    const parser: Parser<string> = (ctx) => {
      contexts.push({ text: ctx.text, index: ctx.index });
      return str("a")(ctx);
    };
    async function* chunks(): AsyncGenerator<string> {
      yield "a";
      yield "a";
      yield "a";
    }

    const values: string[] = [];
    for await (const result of parseStreamEach(parser, chunks())) {
      if (result.success) values.push(result.value);
    }

    expect(values).toEqual(["a", "a", "a"]);
    expect(contexts).toEqual([
      { text: "a", index: 0 },
      { text: "a", index: 0 },
      { text: "a", index: 0 },
    ]);
  });

  test("retain an incomplete value while compacting completed input", async () => {
    async function* chunks(): AsyncGenerator<string> {
      yield "aba";
      yield "b";
    }

    const values: string[] = [];
    for await (const result of parseStreamEach(str("ab"), chunks())) {
      if (result.success) values.push(result.value);
    }

    expect(values).toEqual(["ab", "ab"]);
  });

  test("reject non-advancing repeated parsers", async () => {
    async function* chunks(): AsyncGenerator<string> {
      yield "x";
    }

    const results: Result<string>[] = [];
    for await (const result of parseStreamEach(str(""), chunks())) {
      results.push(result);
    }

    expect(results.at(-1)).toMatchObject({
      success: false,
      expected: "parseStreamEach: parser succeeded without consuming input",
    });
  });

  test("turns a final pending terminator into a failure", async () => {
    async function* chunks(): AsyncGenerator<string> {
      yield "a";
    }

    const results: Result<string>[] = [];
    for await (const result of parseStreamEach(str("a"), chunks(), {
      until: (ctx) => pending(ctx, "terminator"),
    })) {
      results.push(result);
    }

    expect(results.at(-1)).toMatchObject({
      success: false,
      expected: "terminator",
    });
    expect(isPending(results.at(-1)!)).toBe(false);
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

  test("digit reads incrementally without generic regex", () => {
    const stream = createStreamingParser(digit());

    expect(stream.feed("")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("7")).toMatchObject({ success: true, value: 7 });
  });

  test("letter reads incrementally without generic regex", () => {
    const stream = createStreamingParser(letter());

    expect(stream.feed("")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("Q")).toMatchObject({ success: true, value: "Q" });
  });
});

describe("streaming whitespace", () => {
  test("waits while the whitespace token can grow", () => {
    const stream = createStreamingParser(space());

    expect(stream.feed(" \t")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("x")).toMatchObject({ success: true, value: " \t" });
  });

  test("finishes whitespace at final input", () => {
    const stream = createStreamingParser(space());
    expect(stream.feed("\n ")).toMatchObject({ success: false, pending: true });
    expect(stream.finish()).toMatchObject({ success: true, value: "\n " });
  });
});

describe("streaming numbers", () => {
  test("waits for an integer that may become a decimal", () => {
    const stream = createStreamingParser(number());

    expect(stream.feed("29")).toMatchObject({ success: false, pending: true });
    expect(stream.feed(".8 ")).toMatchObject({ success: true, value: 29.8 });
  });

  test("selects an integer after a delimiter", () => {
    expect(createStreamingParser(number()).feed("29 ")).toMatchObject({
      success: true,
      value: 29,
    });
  });

  test("preserves a decimal with no fractional digits", () => {
    const stream = createStreamingParser(double());
    expect(stream.feed("29.")).toMatchObject({ success: false, pending: true });
    expect(stream.finish()).toMatchObject({ success: true, value: 29 });
  });
});

describe("streaming expression chains", () => {
  test("keeps a left-associative chain open for another operator", () => {
    const term: Parser<string> = str("a");
    const stream = createStreamingParser(
      chainl1(term, str("+"), (left, op, right) => left + op + right),
    );

    expect(stream.feed("a")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("+a ")).toMatchObject({
      success: true,
      value: "a+a",
    });
  });

  test("keeps a right-associative chain open for another operator", () => {
    const term: Parser<string> = str("a");
    const stream = createStreamingParser(
      chainr1(term, str("**"), (left, op, right) => left + op + right),
    );

    expect(stream.feed("a*")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("*a ")).toMatchObject({
      success: true,
      value: "a**a",
    });
  });
});

describe("streaming utility wrappers", () => {
  test("keeps peekAnd unresolved without consuming lookahead", () => {
    const stream = createStreamingParser(peekAnd(str("ab"), str("ab")));

    expect(stream.feed("a")).toMatchObject({
      success: false,
      pending: true,
      ctx: { index: 0 },
    });
    expect(stream.feed("b")).toMatchObject({ success: true, value: "ab" });
  });

  test("keeps ifPeek unresolved until its probe finishes", () => {
    const stream = createStreamingParser(ifPeek(str("ab"), str("c")));

    expect(stream.feed("a")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("bc")).toMatchObject({ success: true, value: "c" });
  });

  test("does not rewrite pending results with onFailure", () => {
    let rewrites = 0;
    const parser = onFailure(str("ab"), (result) => {
      rewrites++;
      return { ...result, expected: "rewritten" };
    });
    const stream = createStreamingParser(parser);

    expect(stream.feed("a")).toMatchObject({ success: false, pending: true });
    expect(rewrites).toBe(0);
    expect(stream.finish()).toMatchObject({
      success: false,
      expected: "rewritten",
    });
    expect(rewrites).toBe(1);
  });

  test("does not make pending cut failures fatal", () => {
    const stream = createStreamingParser(cut(str("ab"), "complete token"));

    expect(stream.feed("a")).toMatchObject({
      success: false,
      pending: true,
      fatal: false,
      expected: "ab",
    });
    expect(stream.finish()).toMatchObject({
      success: false,
      fatal: true,
      expected: "complete token",
    });
  });
});

describe("streaming alternative selection", () => {
  test("waits while oneOf alternatives remain unresolved", () => {
    const stream = createStreamingParser(oneOf(str("a"), str("ab")));

    expect(stream.feed("a")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("x")).toMatchObject({ success: true, value: "a" });
  });

  test("preserves pending oneOf results after earlier failures", () => {
    expect(
      createStreamingParser(oneOf(str("x"), str("ab"))).feed("a"),
    ).toMatchObject({ success: false, pending: true, expected: "ab" });
  });

  test("fails oneOf as soon as two alternatives match", () => {
    const result = createStreamingParser(
      oneOf(str("a"), str("a"), str("ab")),
    ).feed("a");

    expect(result).toMatchObject({
      success: false,
      expected: expect.stringContaining("expected single parser to match"),
    });
    expect(isPending(result)).toBe(false);
  });

  test("waits while a furthest alternative may grow", () => {
    const stream = createStreamingParser(furthest(str("a"), str("ab")));

    expect(stream.feed("a")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("x")).toMatchObject({ success: true, value: "a" });
  });
});

describe("streaming lexer", () => {
  test("waits for line-comment prefixes and content", () => {
    const stream = createStreamingParser(lineComment());

    expect(stream.feed("/")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("/ note")).toMatchObject({
      success: false,
      pending: true,
    });
    expect(stream.finish()).toMatchObject({ success: true, value: null });
  });

  test("finishes a line comment when a newline arrives", () => {
    expect(
      createStreamingParser(lineComment()).feed("// note\n"),
    ).toMatchObject({
      success: true,
      value: null,
      ctx: { index: 7, final: false },
    });
  });

  test("waits for a complete block comment", () => {
    const stream = createStreamingParser(blockComment());

    expect(stream.feed("/")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("* note")).toMatchObject({
      success: false,
      pending: true,
    });
    expect(stream.feed("*/")).toMatchObject({ success: true, value: null });
  });

  test("makes an unterminated final block comment fatal", () => {
    const stream = createStreamingParser(blockComment());
    expect(stream.feed("/* note")).toMatchObject({ pending: true });
    expect(stream.finish()).toMatchObject({
      success: false,
      expected: "*/",
      fatal: true,
    });
  });

  test("preserves open input after a closed block comment", () => {
    const stream = createStreamingParser(seq(blockComment(), eof()));

    expect(stream.feed("/* note */")).toMatchObject({
      success: false,
      pending: true,
    });
    expect(stream.finish()).toMatchObject({ success: true });
  });

  test("waits for a keyword identifier boundary", () => {
    const noTrivia: Parser<null> = (ctx) => success(ctx, null);
    const stream = createStreamingParser(keyword("let", noTrivia));

    expect(stream.feed("let")).toMatchObject({ success: false, pending: true });
    expect(stream.feed(" ")).toMatchObject({ success: true, value: "let" });
  });
});

describe("streaming nondeterministic parsers", () => {
  test("waits before publishing recognizer matches", () => {
    const stream = createStreamingParser(recognizeAt(str("a"), str("ab")));

    expect(stream.feed("a")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("x")).toMatchObject({
      success: true,
      value: [{ value: "a", ctx: { index: 1 } }],
    });
  });

  test("preserves open input when stepping a recognizer", () => {
    expect(
      createStreamingParser(step(recognizeAt(str("a")))).feed("ax"),
    ).toMatchObject({ success: true, ctx: { index: 1, final: false } });
  });

  test("waits before publishing furthest matches", () => {
    const stream = createStreamingParser(furthestAll(str("a"), str("ab")));

    expect(stream.feed("a")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("x")).toMatchObject({ success: true, value: ["a"] });
  });

  test("waits before publishing all matches", () => {
    const stream = createStreamingParser(allMatches(str("a"), str("ab")));

    expect(stream.feed("a")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("x")).toMatchObject({ success: true, value: ["a"] });
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
  test("waits before selecting an empty prefix over a longer candidate", () => {
    const stream = createStreamingParser(trie(["", "a"]));

    expect(stream.feed("")).toMatchObject({ success: false, pending: true });
    expect(stream.finish()).toMatchObject({ success: true, value: "" });
  });

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

describe("streaming separated lists", () => {
  test("wait for separators and values split across chunks", () => {
    const stream = createStreamingParser(sepBy(str("x"), str(",")));

    expect(stream.feed("x,")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("x;")).toMatchObject({
      success: true,
      value: ["x", "x"],
      ctx: { index: 3 },
    });
  });

  test("do not turn an incomplete first value into an empty list", () => {
    expect(
      createStreamingParser(sepBy(str("ab"), str(","))).feed("a"),
    ).toMatchObject({ success: false, pending: true });
  });
});

describe("streaming lookahead", () => {
  test("preserves pending without consuming input", () => {
    const stream = createStreamingParser(peek(str("ab")));

    expect(stream.feed("a")).toMatchObject({
      success: false,
      pending: true,
      ctx: { index: 0 },
    });
    expect(stream.feed("b")).toMatchObject({
      success: true,
      value: null,
      ctx: { index: 0 },
    });
  });

  test("negative lookahead remains unresolved at a boundary", () => {
    const stream = createStreamingParser(not(str("x")));

    expect(stream.feed("")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("y")).toMatchObject({ success: true, value: null });
  });

  test("subtraction waits for the excluded parser", () => {
    const stream = createStreamingParser(minus(str("a"), str("ab")));

    expect(stream.feed("a")).toMatchObject({ success: false, pending: true });
    expect(stream.feed("x")).toMatchObject({ success: true, value: "a" });
  });
});
