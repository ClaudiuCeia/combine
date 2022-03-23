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
  either,
sepBy1,
} from "../../../combinators.ts";
import { failure } from "../../../Parser.ts";
import { charWhere, str } from "../../../parsers.ts";
import { ifPeek, map, onFailure, peekAnd } from "../../../utility.ts";
import { oneline } from "../common.ts";
import { SyntaxKind } from "./SyntaxKind.ts";
import { comma, doubleColon } from "./atom.ts";
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
import { RuleAction } from "../AST/RuleAction.ts";
import { RuleKind } from "../AST/RuleKind.ts";
import { Node } from "../AST/Node.ts";
import { Rule } from "../AST/Rule.ts";

/**
 * SyntaxKind.
 */
export const ruleMethod = map(
  terminated(
    any(
      str("read"),
      str("list"),
      str("create"),
      str("update"),
      str("delete"),
      str("write")
    )
  ),
  (...args) => new RuleAction(...args)
);

export const ruleMethodList = keepNonNull(sepBy1(ruleMethod, skip1(comma)));

export const rule = map(
  seqNonNull<RuleAction[] | Node<unknown> | null>(
    map(either(allowKeyword, denyKeyword), (...args) => new RuleKind(...args)),
    terminated(ruleMethodList),
    skip1(doubleColon),
    expr()
  ),
  (...args) => new Rule(...args)
);
