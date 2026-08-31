import { any, not, seq, skipMany, surrounded } from "./combinators.ts";
import { failure, fatalFailure, type Parser, success } from "./Parser.ts";
import { regex, space, str } from "./parsers.ts";
import { map } from "./utility.ts";

export type TriviaParser = Parser<null>;

/**
 * Match and skip a line comment: `// ...` until (but not including) `\n`.
 */
export const lineComment = (): Parser<null> => {
  return map(regex(/\/\/[^\n]*/, "line comment"), () => null);
};

/**
 * Match and skip a block comment (non-greedy).
 */
export const blockComment = (): Parser<null> => {
  return (ctx) => {
    if (!ctx.text.startsWith("/*", ctx.index)) {
      return failure(ctx, "block comment");
    }

    const end = ctx.text.indexOf("*/", ctx.index + 2);
    if (end === -1) {
      return fatalFailure({ text: ctx.text, index: ctx.text.length }, "*/");
    }

    return success({ text: ctx.text, index: end + 2 }, null);
  };
};

/**
 * Default "trivia" parser: whitespace and line/block comments.
 *
 * Designed to be used with `lexeme(...)` so most parsers don't need to handle
 * trivia explicitly.
 */
export const defaultTrivia = (): TriviaParser => {
  const piece = any(space(), lineComment(), blockComment());
  return skipMany(piece);
};

/**
 * Parse `p` and then consume trailing trivia.
 */
export const lexeme = <T>(
  p: Parser<T>,
  trivia: TriviaParser = defaultTrivia(),
): Parser<T> => {
  return map(seq(p, trivia), ([v]) => v);
};

/**
 * Parse a fixed string token and consume trailing trivia.
 */
export const symbol = <const S extends string>(
  s: S,
  trivia: TriviaParser = defaultTrivia(),
): Parser<S> => {
  return lexeme(str(s), trivia);
};

const identContinueChar = (): Parser<string> => {
  return regex(/[a-zA-Z0-9_]/, "identifier char");
};

/**
 * Parse a keyword and consume trailing trivia.
 *
 * Ensures the keyword is not immediately followed by an identifier character.
 */
export const keyword = <const S extends string>(
  s: S,
  trivia: TriviaParser = defaultTrivia(),
): Parser<S> => {
  return lexeme(
    map(seq(str(s), not(identContinueChar())), ([kw]) => kw),
    trivia,
  );
};

export type Lexer = Readonly<{
  trivia: TriviaParser;
  lexeme: <T>(p: Parser<T>) => Parser<T>;
  symbol: <const S extends string>(s: S) => Parser<S>;
  keyword: <const S extends string>(s: S) => Parser<S>;
  parens: <T>(p: Parser<T>) => Parser<T>;
}>;

/**
 * Create a small "lexer layer" around a trivia parser.
 *
 * This keeps grammars readable by centralizing whitespace/comment handling.
 */
export const createLexer = (opts?: { trivia?: TriviaParser }): Lexer => {
  const trivia = opts?.trivia ?? defaultTrivia();
  return {
    trivia,
    lexeme: <T>(p: Parser<T>): Parser<T> => lexeme(p, trivia),
    symbol: <const S extends string>(s: S): Parser<S> => symbol(s, trivia),
    keyword: <const S extends string>(s: S): Parser<S> => keyword(s, trivia),
    parens: <T>(p: Parser<T>): Parser<T> =>
      surrounded(symbol("(", trivia), p, symbol(")", trivia)),
  };
};
