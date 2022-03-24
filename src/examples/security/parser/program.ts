import { skipMany } from "../../../combinators.ts";
import { eof } from "../../../parsers.ts";
import { map } from "../../../utility.ts";
import { matchExpression } from "./match.ts";
import { trivia } from "./trivia.ts";
import { seqNonNull, terminated } from "./combine/combinators.ts";
import { EndOfFileToken } from "../AST/EndOfFileToken.ts";
import { MatchDeclaration } from "../AST/MatchDeclaration.ts";
import { SourceFile } from "../AST/SourceFile.ts";

export function program() {
  return map(
    seqNonNull<MatchDeclaration | null | EndOfFileToken>(
      skipMany(trivia),
      terminated(matchExpression),
      map(eof(), (...args) => new EndOfFileToken(...args))
    ),
    (...args) => new SourceFile(...args)
  );
}
