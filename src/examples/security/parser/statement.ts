import { any, many1, optional, sepBy1, skip1 } from "../../../combinators.ts";
import { Parser } from "../../../Parser.ts";
import { semiColonDelimited } from "./common.ts";
import { ident, expr } from "./expression.ts";
import { continueKeyword, letKeyword, returnKeyword } from "./keyword.ts";
import { seqNonNull, terminated } from "./combine/combinators.ts";
import { str } from "../../../parsers.ts";
import { comma, semiColon } from "./atom.ts";
import { intLiteral } from "./literal.ts";
import { map } from "../../../utility.ts";
import { VariableDeclaration } from "../AST/VariableDeclaration.ts";
import { VariableDeclarationList } from "../AST/VariableDeclarationList.ts";
import { ReturnStatement } from "../AST/ReturnStatement.ts";
import { Node } from "../AST/Node.ts";

export const variableDeclaration = () =>
  map(
    seqNonNull<Node | null | Node[]>(
      ident,
      optional(seqNonNull(skip1(terminated(str("="))), expr()))
    ),
    (...args) => new VariableDeclaration(...args)
  );

export const variableDeclarationList = () =>
  map(
    seqNonNull(
      skip1(letKeyword),
      terminated(sepBy1(variableDeclaration(), comma))
    ),
    (...args) => new VariableDeclarationList(...args)
  );

export const returnStatement = () =>
  map(
    seqNonNull(skip1(returnKeyword), expr()),
    ([ex], ...rest) => new ReturnStatement(ex, ...rest)
  );

export const statement = (): Parser<unknown> =>
  semiColonDelimited(
    any(
      expr(),
      variableDeclarationList() /* , shorthandReassign() */,
      returnStatement()
    )
  );

export const continueStatement = () =>
  seqNonNull<Node<string | number> | string>(
    continueKeyword,
    optional(intLiteral),
    skip1(semiColon)
  );
