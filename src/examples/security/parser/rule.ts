import {
  seq,
  oneOf,
  skipMany,
  sepBy,
  skip1,
  any,
  manyTill,
  surrounded,
  optional,
  peek,
} from "../../../combinators.ts";
import { failure } from "../../../Parser.ts";
import { charWhere, str } from "../../../parsers.ts";
import { ifPeek, map, onFailure, peekAnd } from "../../../utility.ts";
import { Node, node } from "../AST/node.ts";
import { oneline } from "../common.ts";
import { SyntaxKind } from "./SyntaxKind.ts";
import { doubleColon } from "./atom.ts";
import { semiColonDelimited } from "./common.ts";
import { ident, expr } from "./expression.ts";
import { allowKeyword, denyKeyword, skipKeyword } from "./keyword.ts";
import { trivia } from "./trivia.ts";
import {
  keepNonNull,
  seqNonNull,
  toAST,
  terminated,
} from "./combine/combinators.ts";

/**
 * SyntaxKind.
 */
export const ruleMethod = toAST(
  SyntaxKind.RuleMethod,
  terminated(
    any(str("read"), str("create"), str("update"), str("delete"), str("write"))
  )
);

export const ruleMethodList = toAST(
  SyntaxKind.RuleMethodList,
  keepNonNull(sepBy(ruleMethod, skip1(seq(str(","), skipMany(trivia)))))
);

export const patternVariable = toAST(
  SyntaxKind.PatternVariable,
  surrounded(str("["), ident, str("]"))
);

export const pattern = toAST(
  SyntaxKind.Pattern,
  manyTill(
    any(
      patternVariable,
      skipMany(charWhere((code) => code !== "[".charCodeAt(0)))
    ),
    any(trivia, peek(str("{")))
  ),
  (m: (Node<unknown> | null)[]) => {
    return m
      .slice(0, -1)
      .filter((v) => v !== null && v.kind !== SyntaxKind.Trivia);
  }
);

export const rule = semiColonDelimited(
  toAST(
    SyntaxKind.Rule,
    seqNonNull(
      any(allowKeyword, denyKeyword, skipKeyword),
      skipMany(trivia),
      ruleMethodList,
      skipMany(trivia),
      skip1(doubleColon),
      onFailure(expr(), (f) =>
        failure(
          f.ctx,
          oneline`
            This is an invalid expression - only ternary, binary or unary 
            expressions are allowed.  
            If you need more "space", define a function and use it inline.
          `
        )
      )
    )
  )
);
