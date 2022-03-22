import { Context, Failure, failure, Parser, success } from "./Parser.ts";

/**
 * Map the result of a parser using a given function. Useful for building
 * AST nodes or interpreting the parse results. The mapping function receives
 * the result of the parser, as well as the state of the input before and after
 * the parser being applied.
 */
export const map = <A, B>(
  parser: Parser<A>,
  fn: (val: A, before: Context, after: Context) => B
): Parser<B> => {
  return (ctx) => {
    const res = parser(ctx);
    return res.success ? success(res.ctx, fn(res.value, ctx, res.ctx)) : res;
  };
};

/**
 * A simple parser used to collapse a string array parser back into a string.
 * Useful for smaller parsing tasks.
 */
export const mapJoin = (parser: Parser<string[]>): Parser<string> => {
  return (ctx) => map(parser, (parts) => parts.join(""))(ctx);
};

export const lazy = <A>(fn: () => Parser<A>): Parser<A> => {
  return (ctx) => fn()(ctx);
};

export const peekAnd = <A, B>(
  peek: Parser<A>,
  and: Parser<B>
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
 *
 * @param peek A parser to probe the waters with
 * @param continueWith A parser to continue parsing with, if the previous
 * one succeeded. Note that this will take off from where the peek parser
 * left off.
 * @returns
 */
export const ifPeek = <A, B>(
  peek: Parser<A>,
  continueWith: Parser<B>
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
  onFail: (f: Failure) => Failure
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
