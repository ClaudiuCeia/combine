import { assert } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { failure, Parser, Result, success } from "./Parser.ts";
import { map } from "./utility.ts";

/**
 * Unwraps a parser's type (result type)
 *
 * let foo = str("bar");
 * let bar: UnwrapParser<typeof foo>; // string
 */
type UnwrapParser<T> = T extends Parser<infer U> ? U : T;

/**
 * For a list of parsers, unwrap all parsers into an array
 *
 * let foo = [str("bar"), number()];
 * let bar: UnwrapParsers<typeof foo>; // [string, number]
 */
type UnwrapParsers<T extends [...unknown[]]> = T extends [
  infer Head,
  ...infer Tail
]
  ? [UnwrapParser<Head>, ...UnwrapParsers<Tail>]
  : [];

/**
 * Used for sequential combinators, such that:
 *
 * let foo = seq(str("bar"), number); // returns a Parser<[string, number]>
 */
type SequencedParsers<T extends [...Parser<unknown>[]]> = Parser<
  UnwrapParsers<T>
>;

/**
 * Apply a variadic list of parsers sequentially. The return type maintains
 * the order of the parsers such that you get a typed result back.
 *
 * // p is a Parser<[number, string, number, string]>
 * const p = seq(number(), str("-"), number(), str("-"), number());
 */
export const seq = <T extends [...Parser<unknown>[]]>(
  ...parsers: [...T]
): SequencedParsers<T> => {
  return (ctx) => {
    if (parsers.length === 0) {
      return failure(
        ctx,
        `A sequential parser needs to receive at least one parser.`
      );
    }

    const values: unknown[] = [];
    let nextCtx = ctx;

    for (const parser of parsers) {
      const res = parser(nextCtx);
      if (!res.success) {
        return res;
      }

      values.push(res.value);
      nextCtx = res.ctx;
    }

    return success(nextCtx, values as UnwrapParsers<T>);
  };
};

/**
 * Try both parsers in sequence, return the first one that's succesful.
 */
export const either = <A, B>(a: Parser<A>, b: Parser<B>): Parser<A | B> => {
  return (ctx) => {
    return any<A | B>(a, b)(ctx);
  };
};

/**
 * Try all parsers in order, return the first one that is succesful.
 * If none match, return the failure result of the parser that
 * consumed most of the input.
 */
export const any = <T>(...parsers: Parser<T>[]): Parser<T> => {
  return (ctx) => {
    let furthestRes: Result<T> | undefined;
    for (const parser of parsers) {
      const res = parser(ctx);
      if (res.success) {
        return res;
      }

      if (!furthestRes || furthestRes.ctx.index < res.ctx.index) {
        furthestRes = res;
      }
    }

    assert(furthestRes);
    return furthestRes;
  };
};

/**
 * Try all parsers in order. If more than one match is found,
 * it's a failure. If only one matches, return it's result.
 * If none matches, return the failure result of the parser
 * that consumed the most input.
 */
export const oneOf = <T>(...parsers: Parser<T>[]): Parser<T> => {
  return (ctx) => {
    let match: Result<T> | undefined;
    let furthestRes: Result<T> | undefined;
    for (const parser of parsers) {
      const res = parser(ctx);
      if (res.success) {
        if (match) {
          if (match.success) {
            return failure(
              ctx,
              `expected single parser to match, already matched "${JSON.stringify(
                match.value
              )}", now matched ${JSON.stringify(res.value)}`
            );
          } else {
            return failure(ctx, "expected single parser to match", [match]);
          }
        }

        match = res;
      }

      if (!furthestRes || furthestRes.ctx.index < res.ctx.index) {
        furthestRes = res;
      }
    }

    if (match) {
      return match;
    }

    assert(furthestRes);
    return furthestRes;
  };
};

/**
 * Try all parsers in sequence and keep track of which one consumed
 * the most input, then return it.
 */
export const furthest = <T>(...parsers: Parser<T>[]): Parser<T> => {
  return (ctx) => {
    let furthestRes: Result<T> | undefined;
    for (const parser of parsers) {
      const res = parser(ctx);
      if (!furthestRes || furthestRes.ctx.index < res.ctx.index) {
        furthestRes = res;
      }
    }

    assert(furthestRes);
    return furthestRes;
  };
};

/**
 * Try a parser. If it matches, return it, otherwise return a `null`
 * result without consuming any input.
 */
export const optional = <T>(parser: Parser<T>): Parser<T | null> => {
  return any(parser, (ctx) => success(ctx, null));
};

/**
 * Match the same parser until it fails. This parser never fails, so even
 * if it doesn't match it's a succes.
 */
export const many = <T>(parser: Parser<T>): Parser<T[]> => {
  return (ctx) => {
    const values: T[] = [];
    let nextCtx = ctx;

    while (true) {
      const res = parser(nextCtx);
      if (!res.success) {
        break;
      }
      values.push(res.value);
      nextCtx = res.ctx;
    }

    return success(nextCtx, values);
  };
};

/**
 * Match the same parser until it fails. Needs to match at least
 * once to be a success.
 */
export const many1 = <T>(parser: Parser<T>): Parser<T[]> => {
  return (ctx) => {
    const res = many(parser)(ctx);
    if (ctx.index === res.ctx.index) {
      return failure(res.ctx, "Expected at least one match");
    }

    return res;
  };
};

/**
 * Match parser until the second parser matches. The result is a tuple
 * of results for the first parser, with the result of the second parser
 * appended.
 */
export const manyTill = <A, B>(
  parser: Parser<A>,
  end: Parser<B>
): Parser<[...A[], B]> => {
  return (ctx) => {
    const values: A[] = [];
    let nextCtx = ctx;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const maybeEnd = end(nextCtx);
      if (maybeEnd.success) {
        return success(maybeEnd.ctx, [...values, maybeEnd.value]);
      }

      const res = parser(nextCtx);
      if (!res.success) {
        const maybeEnd = end(nextCtx);
        if (maybeEnd.success) {
          return success(maybeEnd.ctx, [...values, maybeEnd.value]);
        } else {
          return maybeEnd;
        }
      }

      values.push(res.value);
      nextCtx = res.ctx;
    }
  };
};

/**
 * Repeatedly match a parser
 */
export const repeat = <T>(n: number, parser: Parser<T>): Parser<T[]> => {
  return (ctx) => {
    const values: T[] = [];
    let nextCtx = ctx;
    let idx = 0;

    while (idx < n) {
      const res = parser(nextCtx);
      if (!res.success) {
        break;
      }
      values.push(res.value);
      nextCtx = res.ctx;
      idx++;
    }

    return success(nextCtx, values);
  };
};

/**
 * Useful for parsing separated lists. Repeatedly match a sequence of both
 * parsers while they both match. Doesn't support trailing separators.
 *
 * const p = sepBy(number(), str(","));
 *
 * const ok = p("1,2,3"); // success
 * const fail = p("1,2,3,"); // failure, expecting one more number
 *
 * If no matches are found, it's a success.
 */
export const sepBy = <T, S>(
  parser: Parser<T>,
  sep: Parser<S>
): Parser<(T | S)[]> => {
  return (ctx) => {
    const values: (T | S)[] = [];
    let nextCtx = ctx;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = parser(nextCtx);
      if (res.success) {
        const sepCtx = res.ctx;
        values.push(res.value);

        const sepRes = sep(sepCtx);
        if (!sepRes.success) {
          return success(sepCtx, values);
        }

        nextCtx = sepRes.ctx;
        values.push(sepRes.value);
        continue;
      }

      return success(nextCtx, values);
    }
  };
};

/**
 * Same as `sepBy`, but at least one match is required.
 */
export const sepBy1 = <T, S>(
  parser: Parser<T>,
  sep: Parser<S>
): Parser<(T | S)[]> => {
  return (ctx) => {
    const res = sepBy(parser, sep)(ctx);
    if (res.ctx.index === ctx.index) {
      const parserTest = parser(ctx);
      if (parserTest.success) {
        // This should never happen since `sepBy` didn't match - need to rewrite for statical guarantee
        return failure(parserTest.ctx, "Unjustified error");
      } else {
        return failure(res.ctx, "Expected at least one match", [parserTest]);
      }
    }

    return res;
  };
};

/**
 * Skips matching parsers while consuming input.
 */
export const skipMany = <T>(parser: Parser<T>): Parser<null> => {
  return (ctx) => {
    const res = many(parser)(ctx);
    return success(res.ctx, null);
  };
};

/**
 * Skips matching parsers while consuming input. At least one match is required.
 */
export const skipMany1 = <T>(parser: Parser<T>): Parser<null> => {
  return (ctx) => {
    const res = many1(parser)(ctx);
    if (res.success) {
      return success(res.ctx, null);
    }

    return failure(res.ctx, "Expected at least a skip");
  };
};

/**
 * Match a parser, but don't consume any input.
 */
export const peek = <T>(parser: Parser<T>): Parser<null> => {
  return (ctx) => {
    const res = parser(ctx);
    if (res.success) {
      return success(ctx, null);
    }

    return failure(ctx, `lookahead failed, ${res.expected}`);
  };
};

/**
 * Skips matching a single parser while consuming input.
 */
export const skip1 = <T>(parser: Parser<T>): Parser<null> => {
  return (ctx) => {
    const res = parser(ctx);
    if (res.success) {
      return success(res.ctx, null);
    }

    return res;
  };
};

export const surrounded = <T>(
  open: Parser<unknown>,
  middle: Parser<T>,
  close: Parser<unknown>
): Parser<T> => {
  /* return (ctx) => {
    const openRes = open(ctx);
    if (openRes.success) {
      let cursor = openRes.ctx;
      let closeRes = close(cursor);
      while (!closeRes.success) {
        const res = middle(cursor);
        if (res.success) {

        }
      }
    }
  } */
  return map(seq(open, middle, close), ([_open, middle, _close]) => middle);
};

export const minus = <T>(a: Parser<T>, b: Parser<unknown>): Parser<T> => {
  return (ctx) => {
    const excludedRes = b(ctx);
    if (excludedRes.success) {
      return failure(
        ctx,
        `Matched excluded "${JSON.stringify(excludedRes.value)}"`
      );
    }

    return a(ctx);
  };
};

export const not = <T>(a: Parser<T>): Parser<null> => {
  return (ctx) => {
    const res = a(ctx);
    if (res.success) {
      return failure(ctx, `Matched "${JSON.stringify(res.value)}"`);
    }

    return success(ctx, null);
  };
};

export const keepNonNull = <T>(parser: Parser<(T | null)[]>): Parser<T[]> =>
  map(parser, (matches) => matches.filter((v) => v !== null) as T[]);

export const seqNonNull = <T>(...parsers: Parser<T | null>[]): Parser<T[]> =>
  keepNonNull(seq(...parsers));
