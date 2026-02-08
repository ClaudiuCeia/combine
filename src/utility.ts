import { optional, seq } from "./combinators.ts";
import {
  type Context,
  type Failure,
  failure,
  fatalFailure,
  getLocation,
  isFatal,
  type Parser,
  pushFrame,
  success,
} from "./Parser.ts";
import { space } from "./parsers.ts";

/**
 * Map the result of a parser using a given function. Useful for building
 * AST nodes or interpreting the parse results. The mapping function receives
 * the result of the parser, as well as the state of the input before and after
 * the parser being applied.
 */
export const map = <A, B>(
  parser: Parser<A>,
  fn: (val: A, before: Context, after: Context, measurement?: string) => B,
  opts?: { trace: boolean; name: string },
): Parser<B> => {
  return (ctx) => {
    const now = (): number => {
      // Avoid relying on DOM lib typings; works in Deno and Node.
      const perf = (globalThis as { performance?: { now?: () => number } })
        .performance;
      return typeof perf?.now === "function" ? perf.now() : Date.now();
    };

    let a = 0,
      b = 0;
    opts?.trace && (a = now());
    const res = parser(ctx);
    opts?.trace && (b = now());

    return res.success
      ? success(
        res.ctx,
        fn(res.value, ctx, res.ctx, opts && (b - a).toFixed(5)),
      )
      : res;
  };
};

/**
 * A simple parser used to collapse a string array parser back into a string.
 * Useful for smaller parsing tasks.
 */
export const mapJoin = (parser: Parser<string[]>): Parser<string> => {
  return (ctx) => map(parser, (parts) => parts.join(""))(ctx);
};

/**
 * Delay parser construction until parse time.
 *
 * Useful to break recursive definitions.
 */
export const lazy = <A>(fn: () => Parser<A>): Parser<A> => {
  return (ctx) => fn()(ctx);
};

/**
 * Run `peek`. If it succeeds, run `and` without consuming input from the peek.
 *
 * If `peek` fails, this fails (does not backtrack like `ifPeek`).
 */
export const peekAnd = <A, B>(
  peek: Parser<A>,
  and: Parser<B>,
): Parser<B | null> => {
  return (ctx) => {
    const res = peek(ctx);
    if (res.success) {
      return and(ctx);
    }

    return failure(ctx, `Peek unsuccesful: expected ${res.expected}`);
  };
};

/**
 * @param peek A parser to probe the waters with
 * @param continueWith A parser to continue parsing with, if the previous
 * one succeeded. Note that this will take off from where the peek parser
 * left off.
 * @returns
 */
export const ifPeek = <A, B>(
  peek: Parser<A>,
  continueWith: Parser<B>,
): Parser<B | null> => {
  return (ctx) => {
    const res = peek(ctx);
    if (res.success) {
      return continueWith(res.ctx);
    }

    return success(ctx, null);
  };
};

/**
 * Map the result of a parser using a given function. Useful for building
 * AST nodes or interpreting the parse results. The mapping function receives
 * the result of the parser, as well as the state of the input before and after
 * the parser being applied.
 */
export const onFailure = <T>(
  parser: Parser<T>,
  onFail: (f: Failure) => Failure,
): Parser<T> => {
  return (ctx) => {
    const res = parser(ctx);
    if (res.success) {
      return res;
    }

    const rewritten = onFail(res);
    return {
      ...rewritten,
      variants: [
        ...rewritten.variants,
        ...res.variants,
        failure(res.ctx, res.expected),
      ],
    };
  };
};

export const trim = <T>(p: Parser<T>): Parser<T> => {
  return map(seq(optional(space()), p, optional(space())), ([_, p]) => p);
};

export type Marked<T> = Readonly<{
  value: T;
  startIndex: number;
  endIndex: number;
}>;

export type WithSpan<T> = Readonly<{
  value: T;
  start: number;
  end: number;
  locationStart: { line: number; column: number };
  locationEnd: { line: number; column: number };
}>;

/**
 * Capture the start and end indices for a successful parse.
 */
export const mark = <T>(parser: Parser<T>): Parser<Marked<T>> => {
  return (ctx) => {
    const res = parser(ctx);
    if (!res.success) return res;

    return success(res.ctx, {
      value: res.value,
      startIndex: ctx.index,
      endIndex: res.ctx.index,
    });
  };
};

/**
 * Capture a span (start/end indices + start/end line/column) for a successful parse.
 */
export const withSpan = <T>(parser: Parser<T>): Parser<WithSpan<T>> => {
  return (ctx) => {
    const res = parser(ctx);
    if (!res.success) return res;

    const start = ctx.index;
    const end = res.ctx.index;
    return success(res.ctx, {
      value: res.value,
      start,
      end,
      locationStart: getLocation(ctx),
      locationEnd: getLocation(res.ctx),
    });
  };
};

/**
 * Add context to a parser's error messages by pushing a frame onto the error stack.
 * This creates TypeScript-style error traces showing where in the grammar the error occurred:
 *
 * ```
 * expected '}' at line 5, column 3
 *   in function body at line 2, column 1
 *   in function declaration at line 2, column 1
 *   in program at line 1, column 1
 * ```
 *
 * @param contextLabel - A human-readable description of the parsing context (e.g., "in function body")
 * @param parser - The parser to wrap with context
 * @returns A parser that adds the label to the error stack on failure
 *
 * @example
 * ```ts
 * const fnDecl = context("in function declaration",
 *   seq(str("fn"), identifier, str("("), params, str(")"), block)
 * );
 * ```
 */
export const context = <T>(
  contextLabel: string,
  parser: Parser<T>,
): Parser<T> => {
  return (ctx) => {
    const res = parser(ctx);
    if (res.success) {
      return res;
    }

    // Add context frame to the error stack
    return pushFrame(res, contextLabel, ctx);
  };
};

/**
 * Mark a point of no return in parsing. After `cut`, if the inner parser fails,
 * the failure becomes fatal and will not be caught by alternative parsers like `any` or `either`.
 *
 * This is useful after parsing enough to "commit" to a grammar branch. For example,
 * after seeing "if", we're committed to parsing an if-expression and shouldn't backtrack.
 *
 * @param parser - The parser that, if it fails, should produce a fatal error
 * @param expected - Optional custom error message for the fatal failure
 * @returns A parser that produces fatal failures
 *
 * @example
 * ```ts
 * // After seeing "if", we're committed - don't backtrack if "then" is missing
 * const ifExpr = seq(
 *   str("if"),
 *   cut(expr, "condition after 'if'"),
 *   cut(str("then"), "'then' keyword"),
 *   cut(expr, "expression after 'then'"),
 *   cut(str("else"), "'else' keyword"),
 *   cut(expr, "expression after 'else'")
 * );
 * ```
 */
export const cut = <T>(parser: Parser<T>, expected?: string): Parser<T> => {
  return (ctx) => {
    const res = parser(ctx);
    if (res.success) {
      return res;
    }

    // If it's already fatal, preserve it
    if (isFatal(res)) {
      return res;
    }

    // Make this failure fatal
    return fatalFailure(
      res.ctx,
      expected ?? res.expected,
      res.stack,
    );
  };
};

/**
 * Attempt a parser, but if it fails with a fatal error, convert it back to a
 * non-fatal failure. This allows catching committed parse errors in specific contexts.
 *
 * @param parser - The parser whose fatal errors should be caught
 * @returns A parser that converts fatal failures to non-fatal ones
 */
export const attempt = <T>(parser: Parser<T>): Parser<T> => {
  return (ctx) => {
    const res = parser(ctx);
    if (res.success) {
      return res;
    }

    // Convert fatal back to non-fatal
    if (res.fatal) {
      return { ...res, fatal: false };
    }

    return res;
  };
};
