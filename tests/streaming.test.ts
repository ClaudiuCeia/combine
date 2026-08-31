import { describe, expect, test } from "bun:test";
import {
  failure,
  isPending,
  pending,
  success,
  type Result,
} from "../src/Parser.ts";

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
