import { seq, skipMany } from "../../../combinators.ts";
import { eof } from "../../../parsers.ts";
import { map } from "../../../utility.ts";
import { node } from "../AST/node.ts";
import { SyntaxKind } from "./SyntaxKind.ts";
import { matchExpression } from "./match.ts";
import { trivia } from "./trivia.ts";
import { seqNonNull, toAST } from "./combine/combinators.ts";

export function program() {
  return toAST(
    SyntaxKind.Program,
    seqNonNull(
      skipMany(trivia),
      matchExpression,
      skipMany(trivia),
      toAST(SyntaxKind.EOF, eof()) as any
    )
  );
}
