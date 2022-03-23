import { seq, skipMany } from "../../../combinators.ts";
import { eof } from "../../../parsers.ts";
import { map } from "../../../utility.ts";
import { SyntaxKind } from "./SyntaxKind.ts";
import { matchExpression } from "./match.ts";
import { trivia } from "./trivia.ts";
import { seqNonNull, terminated, toAST } from "./combine/combinators.ts";
import { EndOfFileToken } from "../AST/EndOfFileToken.ts";
import { MatchDeclaration } from "../AST/MatchDeclaration.ts";

export function program() {
    return seqNonNull<MatchDeclaration | null | EndOfFileToken>(
      skipMany(trivia),
      terminated(matchExpression),
      map(eof(), (...args) => new EndOfFileToken(...args))
    )
}
