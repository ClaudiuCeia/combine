import { Context, failure, Parser, success } from "./Parser.ts";

/**
 * Map the result of a parser using a given function. Useful for building
 * AST nodes or interpreting the parse results. The mapping function receives
 * the result of the parser, as well as the state of the input before and after
 * the parser being applied.
 */
export const map = <A, B>(
  parser: Parser<A>,
  fn: (val: A, before?: Context, after?: Context) => B
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

    return failure(ctx, "Peek unsuccesful");
  };
};
