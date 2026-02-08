import { assert } from "./internal_assert.ts";
import {
  type Context,
  type Failure,
  failure,
  isFatal,
  type Parser,
  type Result,
  success,
} from "./Parser.ts";

/**
 * Nondeterministic combinators.
 *
 * These are closer to "recognizers" / tokenizers: they can return multiple
 * successful alternatives for the same input position.
 *
 * Important:
 * - Do not use these inside `many(...)` unless you are explicitly advancing
 *   the cursor yourself (otherwise you can create non-terminating loops).
 * - When multiple matches exist, you must decide how (or whether) to advance.
 */

/**
 * A single recognized match: a value and the context where that value ends.
 */
export type Recognition<T> = Readonly<{
  value: T;
  ctx: Context;
}>;

type UnwrapParser<T> = T extends Parser<infer U> ? U : T;

type UnwrapParsers<T extends [...unknown[]]> = T extends [
  infer Head,
  ...infer Tail,
] ? [UnwrapParser<Head>, ...UnwrapParsers<Tail>]
  : [];

type ArrayUnion<T extends unknown[]> = T extends [infer Head, ...infer Tail]
  ? Head | ArrayUnion<Tail>
  : never;

/**
 * Run all parsers at the same input position and return every successful match.
 *
 * - On success: returns an array of recognitions (value + end ctx) and does NOT
 *   advance the returned success ctx (it stays at the starting ctx).
 * - If no parser matches: returns the failure of the parser that got furthest.
 * - Fatal failures propagate immediately (no backtracking).
 *
 * Matches are returned sorted by descending end index (longest match first),
 * stable for ties (preserves parser order).
 */
export const recognizeAt = <T extends [...Parser<unknown>[]]>(
  ...parsers: [...T]
): Parser<Recognition<ArrayUnion<UnwrapParsers<T>>>[]> => {
  return (ctx) => {
    if (parsers.length === 0) {
      return failure(ctx, "recognizeAt: expected at least one parser");
    }

    const matches: Recognition<ArrayUnion<UnwrapParsers<T>>>[] = [];
    let furthestFailure: Failure | undefined;

    for (const parser of parsers) {
      const res = parser(ctx) as Result<ArrayUnion<UnwrapParsers<T>>>;

      if (!res.success && isFatal(res)) return res;

      if (res.success) {
        matches.push({ value: res.value, ctx: res.ctx });
        continue;
      }

      if (!furthestFailure || furthestFailure.ctx.index < res.ctx.index) {
        furthestFailure = res;
      }
    }

    if (matches.length === 0) {
      assert(furthestFailure);
      return furthestFailure;
    }

    // Longest match first; stable for equal indexes.
    const sorted = matches
      .map((m, i) => ({ m, i }))
      .sort((a, b) => (b.m.ctx.index - a.m.ctx.index) || (a.i - b.i))
      .map((x) => x.m);

    return success(ctx, sorted);
  };
};

/**
 * Try all parsers and collect all successful matches that consume the most
 * input, then return them as an array and advance to that furthest position.
 *
 * If none match, returns the failure result of the parser that consumed the
 * most input.
 *
 * Fatal errors are propagated immediately.
 */
export const furthestAll = <T extends [...Parser<unknown>[]]>(
  ...parsers: [...T]
): Parser<ArrayUnion<UnwrapParsers<T>>[]> => {
  return (ctx) => {
    if (parsers.length === 0) {
      return failure(
        ctx,
        "furthestAll: expected at least one parser",
      );
    }

    let bestIndex = -1;
    let bestCtx: Context | undefined;
    let bestValues: ArrayUnion<UnwrapParsers<T>>[] = [];

    let furthestFailure: Failure | undefined;

    for (const parser of parsers) {
      const res = parser(ctx) as Result<ArrayUnion<UnwrapParsers<T>>>;

      // Fatal errors propagate immediately - no backtracking
      if (!res.success && isFatal(res)) {
        return res;
      }

      if (res.success) {
        const idx = res.ctx.index;
        if (idx > bestIndex) {
          bestIndex = idx;
          bestCtx = res.ctx;
          bestValues = [res.value];
        } else if (idx === bestIndex) {
          bestValues.push(res.value);
        }
        continue;
      }

      if (!furthestFailure || furthestFailure.ctx.index < res.ctx.index) {
        furthestFailure = res;
      }
    }

    if (bestCtx) {
      return success(bestCtx, bestValues);
    }

    assert(furthestFailure);
    return furthestFailure;
  };
};

/**
 * Try all parsers and collect all successful matches (even if they consume
 * different amounts of input). The returned context advances to the furthest
 * successful match (highest index), so parsing can continue from the longest
 * match.
 *
 * If none match, returns the failure result of the parser that consumed the
 * most input.
 *
 * Fatal errors are propagated immediately.
 */
export const allMatches = <T extends [...Parser<unknown>[]]>(
  ...parsers: [...T]
): Parser<ArrayUnion<UnwrapParsers<T>>[]> => {
  return (ctx) => {
    if (parsers.length === 0) {
      return failure(
        ctx,
        "allMatches: expected at least one parser",
      );
    }

    let bestSuccessCtx: Context | undefined;
    const values: ArrayUnion<UnwrapParsers<T>>[] = [];

    let furthestFailure: Failure | undefined;

    for (const parser of parsers) {
      const res = parser(ctx) as Result<ArrayUnion<UnwrapParsers<T>>>;

      // Fatal errors propagate immediately - no backtracking
      if (!res.success && isFatal(res)) {
        return res;
      }

      if (res.success) {
        values.push(res.value);
        if (!bestSuccessCtx || bestSuccessCtx.index < res.ctx.index) {
          bestSuccessCtx = res.ctx;
        }
        continue;
      }

      if (!furthestFailure || furthestFailure.ctx.index < res.ctx.index) {
        furthestFailure = res;
      }
    }

    if (bestSuccessCtx) {
      return success(bestSuccessCtx, values);
    }

    assert(furthestFailure);
    return furthestFailure;
  };
};
