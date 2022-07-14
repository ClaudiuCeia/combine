import { optional, seq } from "./combinators.ts";
import { Context, Failure, failure, Parser, success } from "./Parser.ts";
import { space } from "./parsers.ts";
import { bgGreen, green, italic } from "https://deno.land/std@0.123.0/fmt/colors.ts";
import { stripIndents } from "https://esm.sh/common-tags@1.8.2";

/**
 * Map the result of a parser using a given function. Useful for building
 * AST nodes or interpreting the parse results. The mapping function receives
 * the result of the parser, as well as the state of the input before and after
 * the parser being applied.
 */
export const map = <A, B>(
  parser: Parser<A>,
  fn: (val: A, before: Context, after: Context, measurement?: string) => B,
  opts?: { trace: boolean; name: string }
): Parser<B> => {
  return (ctx) => {
    let a = 0, b = 0;
    opts?.trace && (a = performance.now());
    const res = parser(ctx);
    opts?.trace && (b = performance.now());

    return res.success
      ? success(
          res.ctx,
          fn(
            res.value,
            ctx,
            res.ctx,
            opts && (b - a).toFixed(5)
          )
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

export const trim = <T>(p: Parser<T>): Parser<T> => {
  return map(seq(optional(space()), p, optional(space())), ([_, p]) => p);
};

export type LanguageDefinition = Record<
  string,
  (self: BoundLanguageDefinition) => Parser<unknown>
>;
export type BoundLanguageDefinition = Record<string, Parser<unknown>>;
export type LanguageDefinitionOpts = {
  debug: boolean;
};

const printTrace = (
  name: string,
  _value: unknown,
  before: Context,
  after: Context,
  measurement?: string,
) => {
  const text = after.text;
  const beforeText = text.substring(0, before.index);
  const afterText = text.substring(after.index);
  const targetText = text.substring(before.index, after.index);

  console.log(stripIndents`
    ${green(beforeText)}${bgGreen(targetText)}${afterText}
    ${name}::${italic(`${measurement}ms`)}
  `);
};

export const createLanguage = (
  def: LanguageDefinition,
  opts?: LanguageDefinitionOpts
): BoundLanguageDefinition => {
  const bound: BoundLanguageDefinition = {};
  for (const [key, func] of Object.entries(def)) {
    const mapOpts = opts?.debug
      ? {
          name: key,
          trace: true,
        }
      : undefined;

    bound[key] = lazy(() =>
      map(
        func.call(null, bound),
        (v, b, a, m) => {
          if (opts?.debug) {
            printTrace(key, null, b, a, m);
          }

          return v;
        },
        mapOpts
      )
    );
  }

  return bound;
};
