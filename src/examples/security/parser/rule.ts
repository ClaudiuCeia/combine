import { skip1, any, either, sepBy1 } from "../../../combinators.ts";
import { str } from "../../../parsers.ts";
import { map } from "../../../utility.ts";
import { comma, doubleColon } from "./atom.ts";
import { expr } from "./expression.ts";
import { allowKeyword, denyKeyword } from "./keyword.ts";
import { keepNonNull, seqNonNull, terminated } from "./combine/combinators.ts";
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
