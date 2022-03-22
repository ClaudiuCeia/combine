import {
  seq,
  optional,
  sepBy,
  surrounded,
  any,
  many1,
  skip1,
} from "../../../combinators.ts";
import { str } from "../../../parsers.ts";
import { map } from "../../../utility.ts";
import { comma } from "./atom.ts";
import { paren } from "./common.ts";
import { forLoop } from "./control.ts";
import { ifStatement } from "./control.ts";
import { ident, expr } from "./expression.ts";
import { fnKeyword } from "./keyword.ts";
import { statement } from "./statement.ts";
import { seqNonNull, terminated, keepNonNull } from "./combine/combinators.ts";
import { Parameter } from "../AST/Parameter.ts";
import { FunctionDeclaration } from "../AST/FunctionDeclaration.ts";

export const functionDeclarationParam = () =>
  map(
    seqNonNull<unknown>(ident, optional(seq(terminated(str("=")), expr()))),
    (...args) => new Parameter(...args)
  );

export const functionDeclarationParams = keepNonNull(
  sepBy(functionDeclarationParam(), skip1(comma))
);

export const functionDeclaration = () =>
  map(
    seqNonNull<unknown>(
      skip1(terminated(fnKeyword)),
      ident,
      paren(functionDeclarationParams),
      surrounded(
        terminated(str("{")),
        many1(any(statement(), ifStatement(), forLoop())),
        terminated(str("}"))
      )
    ),
    (...args) => new FunctionDeclaration(...args)
  );
