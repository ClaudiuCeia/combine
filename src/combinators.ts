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
import { map } from "./utility.ts";

const failedToAdvance = (name: string): string =>
  `${name}: parser succeeded without consuming input (this would loop forever)`;

const assertAdvanced = (
  name: string,
  before: Context,
  after: Context,
): Failure | null => {
  return after.index > before.index
    ? null
    : failure(before, failedToAdvance(name));
};

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
  ...infer Tail,
] ? [UnwrapParser<Head>, ...UnwrapParsers<Tail>]
  : [];

/**
 * For a list of parsers, combine them into an union Parser
 *
 * let foo = [str("bar"), number()];
 * let bar: UnwrapParsers<typeof foo>; // Parser<string | number>
 */
type ArrayUnion<T extends unknown[]> = T extends [infer Head, ...infer Tail]
  ? Head | ArrayUnion<Tail>
  : never;

type UnionParser<T extends unknown[]> = Parser<ArrayUnion<T>>;

// const foo: UnionParser<[string, number]> =
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
        `A sequential parser needs to receive at least one parser.`,
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
 * Fatal errors from either parser will be propagated immediately.
 */
export const either = <A, B>(a: Parser<A>, b: Parser<B>): Parser<A | B> => {
  return (ctx) => {
    return any(a, b)(ctx);
  };
};

/**
 * Try all parsers in order, return the first one that is succesful.
 * If none match, return the failure result of the parser that
 * consumed most of the input.
 *
 * Fatal errors are propagated immediately without trying remaining parsers.
 */
export const any = <T extends [...Parser<unknown>[]]>(
  ...parsers: [...T]
): UnionParser<UnwrapParsers<T>> => {
  return (ctx) => {
    let furthestRes: Result<ArrayUnion<UnwrapParsers<T>>> | undefined;
    for (const parser of parsers) {
      const res = parser(ctx) as Result<ArrayUnion<UnwrapParsers<T>>>;
      if (res.success) {
        return res;
      }

      // Fatal errors propagate immediately - no backtracking
      if (isFatal(res)) {
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
 *
 * Fatal errors are propagated immediately.
 */
export const oneOf = <T>(...parsers: Parser<T>[]): Parser<T> => {
  return (ctx) => {
    let match: Result<T> | undefined;
    let furthestRes: Result<T> | undefined;
    for (const parser of parsers) {
      const res = parser(ctx);

      // Fatal errors propagate immediately
      if (!res.success && isFatal(res)) {
        return res;
      }

      if (res.success) {
        if (match) {
          if (match.success) {
            return failure(
              ctx,
              `expected single parser to match, already matched "${
                JSON.stringify(
                  match.value,
                )
              }", now matched ${JSON.stringify(res.value)}`,
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
 *
 * Fatal errors are propagated immediately.
 */
export const furthest = <T>(...parsers: Parser<T>[]): Parser<T> => {
  return (ctx) => {
    let furthestRes: Result<T> | undefined;
    for (const parser of parsers) {
      const res = parser(ctx);

      // Fatal errors propagate immediately
      if (!res.success && isFatal(res)) {
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
 * Try a parser. If it matches, return it, otherwise return a `null`
 * result without consuming any input.
 *
 * Fatal errors are propagated - optional only catches non-fatal failures.
 */
export const optional = <T>(parser: Parser<T>): Parser<T | null> => {
  return (ctx) => {
    const res = parser(ctx);
    if (res.success) {
      return res;
    }

    // Fatal errors propagate - don't swallow them
    if (isFatal(res)) {
      return res;
    }

    return success(ctx, null);
  };
};

/**
 * Match the same parser until it fails. This parser never fails, so even
 * if it doesn't match it's a succes.
 *
 * Fatal errors are propagated immediately.
 */
export const many = <T>(parser: Parser<T>): Parser<T[]> => {
  return (ctx) => {
    const values: T[] = [];
    let nextCtx = ctx;

    while (true) {
      const res = parser(nextCtx);
      if (!res.success) {
        // Fatal errors propagate
        if (isFatal(res)) {
          return res as unknown as Failure;
        }
        break;
      }

      const advanceErr = assertAdvanced("many", nextCtx, res.ctx);
      if (advanceErr) {
        return advanceErr;
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
 *
 * Fatal errors are propagated immediately.
 */
export const many1 = <T>(parser: Parser<T>): Parser<T[]> => {
  return (ctx) => {
    const res = many(parser)(ctx);

    // Propagate fatal errors
    if (!res.success) {
      return res;
    }

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
 *
 * Fatal errors from either parser are propagated immediately.
 */
export const manyTill = <A, B>(
  parser: Parser<A>,
  end: Parser<B>,
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

      // Fatal errors from end parser propagate
      if (isFatal(maybeEnd)) {
        return maybeEnd;
      }

      const res = parser(nextCtx);
      if (!res.success) {
        // Fatal errors from content parser propagate
        if (isFatal(res)) {
          return res;
        }

        const maybeEnd = end(nextCtx);
        if (maybeEnd.success) {
          return success(maybeEnd.ctx, [...values, maybeEnd.value]);
        } else {
          return maybeEnd;
        }
      }

      const advanceErr = assertAdvanced("manyTill", nextCtx, res.ctx);
      if (advanceErr) {
        return advanceErr;
      }

      values.push(res.value);
      nextCtx = res.ctx;
    }
  };
};

/**
 * Repeatedly match a parser
 *
 * Fatal errors are propagated immediately.
 */
export const repeat = <T>(n: number, parser: Parser<T>): Parser<T[]> => {
  return (ctx) => {
    const values: T[] = [];
    let nextCtx = ctx;
    let idx = 0;

    while (idx < n) {
      const res = parser(nextCtx);
      if (!res.success) {
        // Propagate fatal errors with their stack
        if (isFatal(res)) {
          return res;
        }
        return failure(ctx, res.expected, [], res.stack);
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
 *
 * Fatal errors are propagated immediately.
 */
export const sepBy = <T, S>(
  parser: Parser<T>,
  sep: Parser<S>,
): Parser<(T | S)[]> => {
  return (ctx) => {
    const values: (T | S)[] = [];
    let nextCtx = ctx;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = parser(nextCtx);

      // Fatal errors propagate
      if (!res.success && isFatal(res)) {
        return res;
      }

      if (res.success) {
        const advanceErr = assertAdvanced("sepBy", nextCtx, res.ctx);
        if (advanceErr) {
          return advanceErr;
        }

        const sepCtx = res.ctx;
        values.push(res.value);

        const sepRes = sep(sepCtx);

        // Fatal errors from separator propagate
        if (!sepRes.success && isFatal(sepRes)) {
          return sepRes;
        }

        if (!sepRes.success) {
          return success(sepCtx, values);
        }

        const sepAdvanceErr = assertAdvanced("sepBy", sepCtx, sepRes.ctx);
        if (sepAdvanceErr) {
          return sepAdvanceErr;
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
 *
 * Fatal errors are propagated immediately.
 */
export const sepBy1 = <T, S>(
  parser: Parser<T>,
  sep: Parser<S>,
): Parser<(T | S)[]> => {
  return (ctx) => {
    const res = sepBy(parser, sep)(ctx);

    // Propagate fatal errors
    if (!res.success) {
      return res;
    }

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
 *
 * Fatal errors are propagated immediately.
 */
export const skipMany = <T>(parser: Parser<T>): Parser<null> => {
  return (ctx) => {
    const res = many(parser)(ctx);

    // Propagate fatal errors
    if (!res.success) {
      return res;
    }

    return success(res.ctx, null);
  };
};

/**
 * Skips matching parsers while consuming input. At least one match is required.
 *
 * Fatal errors are propagated immediately.
 */
export const skipMany1 = <T>(parser: Parser<T>): Parser<null> => {
  return (ctx) => {
    const res = many1(parser)(ctx);
    if (res.success) {
      return success(res.ctx, null);
    }

    return res;
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

    return failure(ctx, `lookahead failed, ${res.expected}`, [], res.stack);
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

/**
 * Parse something surrounded by an opening and closing parser, returning only
 * the middle result.
 */
export const surrounded = <T>(
  open: Parser<unknown>,
  middle: Parser<T>,
  close: Parser<unknown>,
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

/**
 * Parse `a` only if `b` does not match at the same position.
 */
export const minus = <T>(a: Parser<T>, b: Parser<unknown>): Parser<T> => {
  return (ctx) => {
    const excludedRes = b(ctx);
    if (excludedRes.success) {
      return failure(
        ctx,
        `Matched excluded "${JSON.stringify(excludedRes.value)}"`,
      );
    }

    return a(ctx);
  };
};

/**
 * Negative lookahead that succeeds with `null` if `a` does not match, and fails
 * if it does.
 */
export const not = <T>(a: Parser<T>): Parser<null> => {
  return (ctx) => {
    const res = a(ctx);
    if (res.success) {
      return failure(ctx, `Matched "${JSON.stringify(res.value)}"`);
    }

    return success(ctx, null);
  };
};

/**
 * Remove `null` values from an array parser result.
 */
export const keepNonNull = <T>(parser: Parser<(T | null)[]>): Parser<T[]> =>
  map(parser, (matches) => matches.filter((v) => v !== null) as T[]);

/**
 * Sequence parsers and keep only non-null results.
 */
export const seqNonNull = <T>(...parsers: Parser<T | null>[]): Parser<T[]> =>
  keepNonNull(seq(...parsers));

/**
 * Parse left-associative infix expressions.
 * Parses: term (op term)* and folds left using the combine function.
 *
 * This is useful for parsing binary operators with the same precedence level.
 *
 * @param term - Parser for the operands
 * @param op - Parser for the operator(s)
 * @param combine - Function to combine left operand, operator, and right operand
 * @returns A parser that produces the left-folded result
 *
 * @example
 * ```ts
 * // Parse addition/subtraction: 1 + 2 - 3 => ((1 + 2) - 3)
 * const addSub = chainl1(
 *   numberParser,
 *   any(str("+"), str("-")),
 *   (left, op, right) => ({ type: "binary", op, left, right })
 * );
 * ```
 *
 * Fatal errors are propagated immediately.
 */
export const chainl1 = <T, Op>(
  term: Parser<T>,
  op: Parser<Op>,
  combine: (left: T, op: Op, right: T) => T,
): Parser<T> => {
  return (ctx) => {
    const firstRes = term(ctx);
    if (!firstRes.success) {
      return firstRes;
    }

    const firstAdvanceErr = assertAdvanced("chainl1", ctx, firstRes.ctx);
    if (firstAdvanceErr) {
      return firstAdvanceErr;
    }

    let acc = firstRes.value;
    let nextCtx = firstRes.ctx;

    while (true) {
      const opRes = op(nextCtx);
      if (!opRes.success) {
        // Fatal errors propagate
        if (isFatal(opRes)) {
          return opRes;
        }
        break;
      }

      const opAdvanceErr = assertAdvanced("chainl1", nextCtx, opRes.ctx);
      if (opAdvanceErr) {
        return opAdvanceErr;
      }

      const rightRes = term(opRes.ctx);
      if (!rightRes.success) {
        // Fatal errors propagate
        if (isFatal(rightRes)) {
          return rightRes;
        }
        // Operator matched but operand didn't - this is a failure
        return rightRes;
      }

      const rightAdvanceErr = assertAdvanced(
        "chainl1",
        opRes.ctx,
        rightRes.ctx,
      );
      if (rightAdvanceErr) {
        return rightAdvanceErr;
      }

      acc = combine(acc, opRes.value, rightRes.value);
      nextCtx = rightRes.ctx;
    }

    return success(nextCtx, acc);
  };
};

/**
 * Parse right-associative infix expressions.
 * Parses: term (op term)* and folds right using the combine function.
 *
 * This is useful for operators like exponentiation: 2 ** 3 ** 4 => 2 ** (3 ** 4)
 *
 * @param term - Parser for the operands
 * @param op - Parser for the operator(s)
 * @param combine - Function to combine left operand, operator, and right operand
 * @returns A parser that produces the right-folded result
 *
 * @example
 * ```ts
 * // Parse exponentiation: 2 ** 3 ** 4 => 2 ** (3 ** 4)
 * const pow = chainr1(
 *   numberParser,
 *   str("**"),
 *   (left, op, right) => ({ type: "binary", op, left, right })
 * );
 * ```
 *
 * Fatal errors are propagated immediately.
 */
export const chainr1 = <T, Op>(
  term: Parser<T>,
  op: Parser<Op>,
  combine: (left: T, op: Op, right: T) => T,
): Parser<T> => {
  return (ctx) => {
    const firstRes = term(ctx);
    if (!firstRes.success) {
      return firstRes;
    }

    const firstAdvanceErr = assertAdvanced("chainr1", ctx, firstRes.ctx);
    if (firstAdvanceErr) {
      return firstAdvanceErr;
    }

    // Collect all terms and operators
    const terms: T[] = [firstRes.value];
    const ops: Op[] = [];
    let nextCtx = firstRes.ctx;

    while (true) {
      const opRes = op(nextCtx);
      if (!opRes.success) {
        // Fatal errors propagate
        if (isFatal(opRes)) {
          return opRes;
        }
        break;
      }

      const opAdvanceErr = assertAdvanced("chainr1", nextCtx, opRes.ctx);
      if (opAdvanceErr) {
        return opAdvanceErr;
      }

      const rightRes = term(opRes.ctx);
      if (!rightRes.success) {
        // Fatal errors propagate
        if (isFatal(rightRes)) {
          return rightRes;
        }
        // Operator matched but operand didn't - this is a failure
        return rightRes;
      }

      const rightAdvanceErr = assertAdvanced(
        "chainr1",
        opRes.ctx,
        rightRes.ctx,
      );
      if (rightAdvanceErr) {
        return rightAdvanceErr;
      }

      ops.push(opRes.value);
      terms.push(rightRes.value);
      nextCtx = rightRes.ctx;
    }

    // Fold right: a op b op c => a op (b op c)
    let acc = terms[terms.length - 1];
    for (let i = terms.length - 2; i >= 0; i--) {
      acc = combine(terms[i], ops[i], acc);
    }

    return success(nextCtx, acc);
  };
};
