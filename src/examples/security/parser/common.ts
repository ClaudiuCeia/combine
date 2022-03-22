import { skip1, skipMany, surrounded } from "../../../combinators.ts";
import { Parser } from "../../../Parser.ts";
import { str } from "../../../parsers.ts";
import { Node } from "../AST/Node.ts";
import { semiColon } from "./atom.ts";
import { seqNonNull, terminated } from "./combine/combinators.ts";
import { SyntaxKind } from "./SyntaxKind.ts";
import { trivia } from "./trivia.ts";

export const paren = <T>(parser: Parser<T>): Parser<T> =>
  surrounded(terminated(str("(")), parser, terminated(str(")")));

/**
 *
 * @param p A parser of choice
 * @returns A parser that parses your parser, followed by trivia and a
 * semicolon, and drops the trivia for the return value. Useful for
 * defining statement parsers.
 */
export const semiColonDelimited = <T>(
  p: Parser<Node<T>>
): Parser<Node<unknown>[]> => {
  return terminated(seqNonNull(p, skipMany(trivia), skip1(semiColon)));
};

export const kindName = (code: SyntaxKind) => {
  const pair = Object.entries(SyntaxKind).find(([_k, v]) => v === code);
  return pair ? pair[0] : undefined;
};
