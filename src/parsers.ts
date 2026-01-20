import { either, skipMany1, many1, seq, peek, any } from "./combinators.ts";
import { failure, type Parser, success } from "./Parser.ts";
import { Trie } from "./Trie.ts";
import { map } from "./utility.ts";

/**
 * Matches a given string.
 */
export const str = (match: string): Parser<string> => {
  return (ctx) => {
    const endIdx = ctx.index + match.length;
    if (ctx.text.substring(ctx.index, endIdx) === match) {
      return success({ ...ctx, index: endIdx }, match);
    } else {
      return failure(ctx, match);
    }
  };
};

/**
 * Matches any of the given strings by using a trie.
 * Use instead of `any(str("..."), ...) when you want
 * to match against many possible strings.
 */
export const trie = (matches: string[]): Parser<string> => {
  // Build trie once at parser creation time, not on every parse
  const t = new Trie();
  t.insertMany(matches);
  const longest = matches.reduce(
    (acc, s) => (s.length > acc ? s.length : acc),
    0
  );

  return (ctx) => {
    const candidate = ctx.text.substring(ctx.index, ctx.index + longest);
    const [exists, match] = t.existsSubstring(candidate);
    if (exists && match) {
      return success(
        {
          ...ctx,
          index: ctx.index + match.length,
        },
        match
      );
    }

    return failure(ctx, `Expected one of ${matches.join(", ")}`);
  };
};

/**
 * Matches a given character by UTF-16 code.
 */
export const char = (code: number): Parser<string> => {
  return (ctx) => {
    const match = String.fromCharCode(code);
    return str(match)(ctx);
  };
};

/**
 * Matches any single character.
 */
export const anyChar = (): Parser<string> => {
  return (ctx) => {
    if (ctx.index === ctx.text.length) {
      return failure(ctx, "reached end of input");
    }

    return success(
      { ...ctx, index: ctx.index + 1 },
      ctx.text.substring(ctx.index, ctx.index + 1)
    );
  };
};

/**
 * Matches any character not matching the given UTF-16 code.
 */
export const notChar = (code: number): Parser<string> => {
  return (ctx) => {
    const res = char(code)(ctx);
    const matchLength = String.fromCharCode(code).length;
    if (!res.success) {
      const endIdx = res.ctx.index + matchLength;
      return success(
        { ...res.ctx, index: endIdx },
        res.ctx.text.substring(res.ctx.index, endIdx)
      );
    }

    return failure(
      { ...res.ctx, index: res.ctx.index - matchLength },
      `found char "${res.value}"`
    );
  };
};

/**
 * Matches any character based on a predicate.
 */
export const charWhere = (pred: (code: number) => boolean): Parser<string> => {
  return (ctx) => {
    const res = regex(/./, "expected any single char")(ctx);
    if (!res.success) {
      return res;
    }

    const satisfied = pred(res.value.charCodeAt(0));
    if (satisfied) {
      return res;
    }

    return failure(res.ctx, `char ${res.value} failed the predicate`);
  };
};

/**
 * Skips matching any character not matching the given UTF-16 code.
 */
export const skipCharWhere = (
  pred: (code: number) => boolean
): Parser<string | null> => {
  return (ctx) => {
    const res = charWhere(pred)(ctx);
    if (!res.success) {
      return res;
    }

    return success(res.ctx, null);
  };
};

/**
 * Matches any single decimal digit
 */
export const digit = (): Parser<number> => {
  return (ctx) => {
    const isDigit = regex(/[0-9]/, "expected digit");

    return map(isDigit, (digit) => {
      return parseInt(digit, 10);
    })(ctx);
  };
};

/**
 * Matches any single letter (case insesitive A-Z)
 */
export const letter = (): Parser<string> => {
  return (ctx) => {
    return regex(/[a-zA-Z]/, "expected letter")(ctx);
  };
};

/**
 * Matches any whitespace
 */
export const space = (): Parser<string> => {
  return (ctx) => {
    return regex(/\s+/, "expected whitespace")(ctx);
  };
};

/**
 * Matches any `count` characters as long as there's enough input
 * left to parse.
 */
export const take = (count: number): Parser<string> => {
  return (ctx) => {
    const endIdx = ctx.index + count;
    if (endIdx <= ctx.text.length) {
      return success(
        { ...ctx, index: endIdx },
        ctx.text.substring(ctx.index, endIdx)
      );
    } else {
      return failure(ctx, "unexpected end of input");
    }
  };
};

/**
 * Matches the rest of the input.
 */
export const takeText = (): Parser<string> => {
  return (ctx) => {
    return success(
      { ...ctx, index: ctx.text.length },
      ctx.text.substring(ctx.index, ctx.text.length)
    );
  };
};

/**
 * Matches an end of line marker
 */
export const eol = (): Parser<string> => {
  return (ctx) => {
    return either(str("\n"), str("\r\n"))(ctx);
  };
};

/**
 * Matches if there's no input left to parse
 */
export const eof = (): Parser<null> => {
  return (ctx) => {
    if (ctx.index < ctx.text.length) {
      return failure(ctx, "eof not reached");
    }

    return success(ctx, null);
  };
};

/**
 * Matches horizontal space (spaces/tabs), if at least one space
 * follows.
 */
export const horizontalSpace = (): Parser<null> => {
  return (ctx) => {
    return skipMany1(
      charWhere((code) => String.fromCharCode(code).trim() === "")
    )(ctx);
  };
};

/**
 * Matches a positive integer
 */
export const int = (): Parser<number> => {
  return (ctx) => {
    return map(many1(digit()), (digits) => parseInt(digits.join("")))(ctx);
  };
};

/**
 * Matches a dot-separated double
 */
export const double = (): Parser<number> => {
  return (ctx) => {
    const comma = str(".");
    const fractional = map(seq(comma, int()), (fraction) => fraction[1]);

    return map(
      seq(
        int(),
        either(
          fractional,
          map(str("."), () => 0)
        )
      ),
      (double) => {
        return parseFloat(double.join("."));
      }
    )(ctx);
  };
};

/**
 * Matches a hexadecimal digit
 */
export const hexDigit = (): Parser<string> => {
  return (ctx) =>
    map(
      any(
        digit(),
        charWhere((code) => code >= 65 && code <= 70), // A-F
        charWhere((code) => code >= 97 && code <= 102) // a-f
      ),
      (digit) => digit.toString()
    )(ctx);
};

/**
 * Matches a hexadecimal number (`0x` lead not allowed)
 */
export const hex = (): Parser<string> => {
  return (ctx) => {
    const lead = peek(str("0x"))(ctx);
    if (lead.success) {
      return failure(ctx, "unexpected 0x lead");
    }

    return map(many1(hexDigit()), (hex) => hex.join())(ctx);
  };
};

/**
 * Matches a positive decimal number
 */
export const number = (): Parser<number> => {
  return (ctx) => either(double(), int())(ctx);
};

/**
 * Matches a signed decimal number (with explicit +/- sign)
 */
export const signed = (nParser: Parser<number> = number()): Parser<number> => {
  return (ctx) => {
    return map(seq(either(str("+"), str("-")), nParser), (out) => {
      const [sign, num] = out;
      if (sign === "+") {
        return num;
      }
      return -num;
    })(ctx);
  };
};

/**
 * Matches input for given regex
 */
export const regex = (re: RegExp, expected: string): Parser<string> => {
  return (ctx) => {
    // Non-global regexps don't support `lastIndex`
    const globalRe = new RegExp(
      re.source,
      re.global ? re.flags : `${re.flags}g`
    );

    globalRe.lastIndex = ctx.index;
    const res = globalRe.exec(ctx.text);
    if (res && res.index === ctx.index) {
      return success({ ...ctx, index: ctx.index + res[0].length }, res[0]);
    } else {
      return failure(ctx, expected);
    }
  };
};
