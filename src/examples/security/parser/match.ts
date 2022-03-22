import {
  peek,
  seq,
  skipMany,
  sepBy1,
  manyTill,
  surrounded,
  many,
  skip1,
  any,
} from "../../../combinators.ts";
import { Context, failure } from "../../../Parser.ts";
import { charWhere, str } from "../../../parsers.ts";
import { map, onFailure } from "../../../utility.ts";
import { functionDeclaration } from "./function.ts";
import { rule } from "./rule.ts";
import { trivia } from "./trivia.ts";
import { keepNonNull, seqNonNull, terminated } from "./combine/combinators.ts";
import { ident } from "./expression.ts";
import { MatchPatternSpan } from "../AST/MatchPatternSpan.ts";
import { MatchPatternExpression } from "../AST/MatchPatternExpression.ts";
import { MatchPatternMiddle } from "../AST/MatchPatternMiddle.ts";
import { MatchPatternHead } from "../AST/MatchPatternHead.ts";
import { Node } from "../AST/Node.ts";
import { MatchPatternTail } from "../AST/MatchPatternTail.ts";
import { MatchDeclaration } from "../AST/MatchDeclaration.ts";
import { Block } from "../AST/Block.ts";

const lookaheadClose = peek(seq(skipMany(trivia), str("}")));

export const matchBlock = seqNonNull<unknown>(
  skipMany(trivia),
  many(functionDeclaration()),
  skipMany(trivia),
  keepNonNull(
    onFailure(manyTill(sepBy1(rule, skipMany(trivia)), lookaheadClose), (f) => {
      /**
       * We're trying to parse rules all the way to the end of the match block.
       * If we failed here, considering we have a lookahead for the closing brace,
       * it must be an invalid rule.
       *
       * Let's try it again so we get an accurate error message.
       */
      const res = rule(f.ctx);
      if (!res.success) {
        return failure(
          f.ctx,
          "This doesn't appear to be a syntactically correct rule",
          [failure(res.ctx, res.expected)]
        );
      }

      return f;
    })
  ),
  terminated(lookaheadClose)
);

export const patternLiteral = map(
  many(charWhere((code) => code !== "[".charCodeAt(0))),
  (m) => m.join("")
);

export const patternSpan = (
  mapper: (m: string, b: Context, a: Context) => Node
) =>
  map(
    seq(surrounded(str("["), ident, str("]")), map(patternLiteral, mapper)),
    (...args) => new MatchPatternSpan(...args)
  );

export const pattern = map(
  seq<any>(
    map(patternLiteral, (...args) => new MatchPatternHead(...args)),
    many(patternSpan((...args) => new MatchPatternMiddle(...args))),
    many(patternSpan((...args) => new MatchPatternTail(...args)))
  ),
  (...args) => new MatchPatternExpression(...args)
);

export const matchExpression = map(
  seqNonNull<MatchPatternExpression | null | Block>(
    (skip1(terminated(str("match"))),
    pattern,
    map(
      surrounded(terminated(str("{")), matchBlock, terminated(str("}"))),
      (...args) => new Block(...args)
    ))
  ),
  (...args) => new MatchDeclaration(...args)
);
