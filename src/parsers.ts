import { any, either, many1, peek, seq, skipMany1 } from "./combinators.ts";
import { failure, type Parser, pending, success } from "./Parser.ts";
import { Trie } from "./Trie.ts";
import { map } from "./utility.ts";

/**
 * Matches a given string.
 */
export const str = <const Match extends string>(
  match: Match,
): Parser<Match> => {
  return (ctx) => {
    const endIdx = ctx.index + match.length;
    if (ctx.text.substring(ctx.index, endIdx) === match) {
      return success(
        ctx.final === false
          ? { text: ctx.text, index: endIdx, final: false }
          : { text: ctx.text, index: endIdx },
        match,
      );
    }

    const available = ctx.text.substring(ctx.index);
    if (
      ctx.final === false &&
      available.length < match.length &&
      match.startsWith(available)
    ) {
      return pending(ctx, match);
    }

    return failure(ctx, match);
  };
};

/**
 * Matches any of the given strings by using a trie.
 * Use instead of `any(str("..."), ...) when you want
 * to match against many possible strings.
 */
export const trie = (matches: string[]): Parser<string> => {
  const candidates = [...matches];

  // Build trie once at parser creation time, not on every parse
  const t = new Trie();
  t.insertMany(candidates);
  const longest = candidates.reduce(
    (acc, s) => (s.length > acc ? s.length : acc),
    0,
  );

  return (ctx) => {
    if (candidates.length === 0) {
      return failure(ctx, "trie: expected at least one match");
    }

    const candidate = ctx.text.substring(ctx.index, ctx.index + longest);
    const [exists, match] = t.existsSubstring(candidate);
    if (exists && match !== undefined) {
      return success(
        {
          text: ctx.text,
          index: ctx.index + match.length,
        },
        match,
      );
    }

    return failure(ctx, `one of ${candidates.join(", ")}`);
  };
};

const isUtf16Code = (code: number): boolean =>
  Number.isInteger(code) && code >= 0 && code <= 0xffff;

/**
 * Matches a given character by UTF-16 code.
 */
export const char = (code: number): Parser<string> => {
  return (ctx) => {
    if (!isUtf16Code(code)) {
      return failure(ctx, "char: code must be an integer between 0 and 65535");
    }

    const match = String.fromCharCode(code);
    return str(match)(ctx);
  };
};

/**
 * Matches any single character.
 */
export const anyChar = (): Parser<string> => {
  return (ctx) => {
    if (ctx.index >= ctx.text.length) {
      if (ctx.final === false) {
        return pending(ctx, "character");
      }
      return failure(ctx, "reached end of input");
    }

    return success(
      ctx.final === false
        ? { text: ctx.text, index: ctx.index + 1, final: false }
        : { text: ctx.text, index: ctx.index + 1 },
      ctx.text.substring(ctx.index, ctx.index + 1),
    );
  };
};

/**
 * Matches any character not matching the given UTF-16 code.
 */
export const notChar = (code: number): Parser<string> => {
  const read = anyChar();
  return (ctx) => {
    if (!isUtf16Code(code)) {
      return failure(
        ctx,
        "notChar: code must be an integer between 0 and 65535",
      );
    }

    const res = read(ctx);
    if (!res.success) return res;

    if (res.value === String.fromCharCode(code)) {
      return failure(ctx, `found char "${res.value}"`);
    }

    return res;
  };
};

/**
 * Matches any character based on a predicate.
 */
export const charWhere = (pred: (code: number) => boolean): Parser<string> => {
  return (ctx) => {
    const res = anyChar()(ctx);
    if (!res.success) {
      return res;
    }

    const satisfied = pred(res.value.charCodeAt(0));
    if (satisfied) {
      return res;
    }

    return failure(ctx, `char ${res.value} failed the predicate`);
  };
};

/**
 * Skips a character matching the given predicate.
 */
export const skipCharWhere = (
  pred: (code: number) => boolean,
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
  return map(regex(/[0-9]/, "digit"), (value) => parseInt(value, 10));
};

/**
 * Matches any single letter (case insesitive A-Z)
 */
export const letter = (): Parser<string> => {
  return regex(/[a-zA-Z]/, "letter");
};

/**
 * Matches any whitespace
 */
export const space = (): Parser<string> => {
  return regex(/\s+/, "whitespace");
};

/**
 * Matches any `count` characters as long as there's enough input
 * left to parse.
 */
export const take = (count: number): Parser<string> => {
  return (ctx) => {
    if (!Number.isSafeInteger(count) || count < 0) {
      return failure(ctx, "take: count must be a non-negative safe integer");
    }

    const endIdx = ctx.index + count;
    if (endIdx <= ctx.text.length) {
      return success(
        ctx.final === false
          ? { text: ctx.text, index: endIdx, final: false }
          : { text: ctx.text, index: endIdx },
        ctx.text.substring(ctx.index, endIdx),
      );
    }

    return ctx.final === false
      ? pending(ctx, `${count} characters`)
      : failure(ctx, "unexpected end of input");
  };
};

/**
 * Matches the rest of the input.
 */
export const takeText = (): Parser<string> => {
  return (ctx) => {
    if (ctx.final === false) {
      return pending(ctx, "final input");
    }

    return success(
      { text: ctx.text, index: ctx.text.length },
      ctx.text.substring(ctx.index, ctx.text.length),
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

    if (ctx.final === false) {
      return pending(ctx, "end of input");
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
    return skipMany1(charWhere((code) => code === 0x20 || code === 0x09))(ctx);
  };
};

/**
 * Matches a positive safe integer. Inputs outside JavaScript's safe integer
 * range fail rather than returning a rounded or infinite value.
 */
export const int = (): Parser<number> => {
  const digitsParser = many1(digit());
  return (ctx) => {
    const res = digitsParser(ctx);
    if (!res.success) return res;

    const value = Number(res.value.join(""));
    return Number.isSafeInteger(value)
      ? success(res.ctx, value)
      : failure(res.ctx, "safe integer");
  };
};

/**
 * Matches a finite dot-separated double.
 */
export const double = (): Parser<number> => {
  const decimal = regex(/[0-9]+\.[0-9]*/, "decimal number");
  return (ctx) => {
    const res = decimal(ctx);
    if (!res.success) return res;

    const value = Number(res.value);
    return Number.isFinite(value)
      ? success(res.ctx, value)
      : failure(res.ctx, "finite decimal number");
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
        charWhere((code) => code >= 97 && code <= 102), // a-f
      ),
      (digit) => digit.toString(),
    )(ctx);
};

/**
 * Matches a hexadecimal number (`0x` lead not allowed)
 */
export const hex = (): Parser<string> => {
  return (ctx) => {
    const lead = peek(regex(/0[xX]/, "hexadecimal prefix"))(ctx);
    if (lead.success) {
      return failure(ctx, "unexpected 0x lead");
    }

    return map(many1(hexDigit()), (hex) => hex.join(""))(ctx);
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
  // Prefer sticky matching to avoid searching ahead from `lastIndex`.
  // This also lets us compile the regexp once at parser creation time.
  const flagsWithSticky = re.flags.includes("y") ? re.flags : `${re.flags}y`;
  const flags = flagsWithSticky.replace("g", "");
  const stickyRe = new RegExp(re.source, flags);

  return (ctx) => {
    stickyRe.lastIndex = ctx.index;
    const res = stickyRe.exec(ctx.text);
    return res && res.index === ctx.index
      ? success({ text: ctx.text, index: res.index + res[0].length }, res[0])
      : failure(ctx, expected);
  };
};
