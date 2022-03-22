import {
  either,
  manyTill,
  oneOf,
  peek,
  surrounded,
} from "../../../combinators.ts";
import { space, str, anyChar, eol } from "../../../parsers.ts";
import { keepNonNull } from "./combine/combinators.ts";
import { map, mapJoin, peekAnd } from "../../../utility.ts";

/**
 * SyntaxKind.Trivia
 *
 * Any code that's not relevant for the program (whitespace, comments)
 */
export const spaceTrivia = space();

export const commentTrivia = either(
  surrounded(
    str("/*"),
    map(manyTill(anyChar(), peek(str("*/"))), (v) =>
      v.filter((m) => m !== null).join("")
    ),
    str("*/")
  ),
  peekAnd(str("//"), manyTill(anyChar(), eol()))
);

export const trivia = oneOf(spaceTrivia, commentTrivia /* terminalTrivia */);
