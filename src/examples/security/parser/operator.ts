import { furthest } from "../../../combinators.ts";
import { str } from "../../../parsers.ts";
import { map } from "../../../utility.ts";
import { AmpersandAmpersandToken } from "../AST/AmpersandAmpersandToken.ts";
import { AsteriskToken } from "../AST/AsteriskToken.ts";
import { BarBarToken } from "../AST/BarBarToken.ts";
import { EqualsEqualsToken } from "../AST/EqualsEqualsToken.ts";
import { ExclamationEqualsToken } from "../AST/ExclamationEqualsToken.ts";
import { GreaterThanOrEqualToken } from "../AST/GreaterThanOrEqualToken.ts";
import { GreaterThanToken } from "../AST/GreaterThanToken.ts";
import { InKeyword } from "../AST/InKeyword.ts";
import { LessThanOrEqualToken } from "../AST/LessThanOrEqualToken.ts";
import { LessThanToken } from "../AST/LessThanToken.ts";
import { MinusToken } from "../AST/MinusToken.ts";
import { Node } from "../AST/Node.ts";
import { PercentToken } from "../AST/PercentToken.ts";
import { PlusEqualsToken } from "../AST/PlusEqualsToken.ts";
import { PlusToken } from "../AST/PlusToken.ts";
import { SlashToken } from "../AST/SlashToken.ts";
import { terminated } from "./combine/combinators.ts";

export const relOperator = furthest<Node>(
  map(terminated(str("<")), (...args) => new LessThanToken(...args)),
  map(terminated(str("<=")), (...args) => new LessThanOrEqualToken(...args)),
  map(terminated(str(">=")), (...args) => new GreaterThanOrEqualToken(...args)),
  map(terminated(str(">")), (...args) => new GreaterThanToken(...args)),
  map(terminated(str("==")), (...args) => new EqualsEqualsToken(...args)),
  map(terminated(str("!=")), (...args) => new ExclamationEqualsToken(...args)),
  map(terminated(str("in")), (...args) => new InKeyword(...args))
);

export const logicalOr = map(
  terminated(str("||")),
  (...args) => new BarBarToken(...args)
);

export const logicalAnd = map(
  terminated(str("&&")),
  (...args) => new AmpersandAmpersandToken(...args)
);

export const plusOp = map(
  terminated(str("+")),
  (...args) => new PlusToken(...args)
);
export const minusOp = map(
  terminated(str("-")),
  (...args) => new MinusToken(...args)
);

export const mulOp = map(
  terminated(str("*")),
  (...args) => new AsteriskToken(...args)
);

export const divOp = map(
  terminated(str("/")),
  (...args) => new SlashToken(...args)
);

export const modOp = map(
  terminated(str("%")),
  (...args) => new PercentToken(...args)
);

export const plusEq = map(
  terminated(str("+=")),
  (...args) => new PlusEqualsToken(...args)
);
