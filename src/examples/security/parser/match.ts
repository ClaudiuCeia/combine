import {
  peek,
  seq,
  skipMany,
  surrounded,
  many,
  skip1,
  optional,
  many1,
} from "../../../combinators.ts";
import { Context } from "../../../Parser.ts";
import { regex, str } from "../../../parsers.ts";
import { map } from "../../../utility.ts";
import { functionDeclaration } from "./function.ts";
import { rule } from "./rule.ts";
import { trivia } from "./trivia.ts";
import { seqNonNull, terminated } from "./combine/combinators.ts";
import { ident } from "./expression.ts";
import { MatchPatternSpan } from "../AST/MatchPatternSpan.ts";
import { MatchPatternExpression } from "../AST/MatchPatternExpression.ts";
import { MatchPatternMiddle } from "../AST/MatchPatternMiddle.ts";
import { MatchPatternHead } from "../AST/MatchPatternHead.ts";
import { Node } from "../AST/Node.ts";
import { MatchPatternTail } from "../AST/MatchPatternTail.ts";
import { MatchDeclaration } from "../AST/MatchDeclaration.ts";
import { Block } from "../AST/Block.ts";
import { semiColon } from "./atom.ts";

export const matchBlock = map(seq(
  many(functionDeclaration()),
  many1(seqNonNull(terminated(rule), skip1(semiColon)))
), ([fns, rules]) => [...fns, ...rules]);

export const patternLiteral = regex(
  /[^\s\[]+/,
  ""
);

export const patternSpan = (
  mapper: (m: string, b: Context, a: Context) => Node
) =>
  map(
    seq(
      surrounded(str("["), ident, str("]")),
      optional(map(patternLiteral, mapper))
    ),
    (...args) => new MatchPatternSpan(...args)
  );

export const pattern = map(
  seqNonNull<any>(
    map(patternLiteral, (...args) => new MatchPatternHead(...args)),
    many(patternSpan((...args) => new MatchPatternMiddle(...args))),
    many(patternSpan((...args) => new MatchPatternTail(...args))),
    skipMany(trivia)
  ),
  (...args) => new MatchPatternExpression(...args)
);

export const matchExpression = map(
  seqNonNull<MatchPatternExpression | null | Block>(
    skip1(terminated(str("match"))),
    pattern,
    map(
      surrounded(terminated(str("{")), matchBlock, terminated(str("}"))),
      (...args) => new Block(...args)
    )
  ),
  (...args) => new MatchDeclaration(...args)
);
