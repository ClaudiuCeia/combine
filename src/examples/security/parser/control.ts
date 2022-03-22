import {
  skipMany,
  any,
  surrounded,
  skip1,
  many1,
  furthest,
} from "../../../combinators.ts";
import { Parser } from "../../../Parser.ts";
import { str } from "../../../parsers.ts";
import { lazy, ifPeek, peekAnd, map } from "../../../utility.ts";
import { semiColon } from "./atom.ts";
import { paren } from "./common.ts";
import { expr } from "./expression.ts";
import { breakKeyword, elseKeyword, forKeyword, ifKeyword } from "./keyword.ts";
import {
  continueStatement,
  statement,
  variableDeclarationList,
} from "./statement.ts";
import { trivia } from "./trivia.ts";
import { seqNonNull, terminated } from "./combine/combinators.ts";
import { ForStatement } from "../AST/ForStatement.ts";
import { IfStatement } from "../AST/IfStatement.ts";

export const forLoop = (): Parser<unknown> =>
  map(
    seqNonNull(
      skip1(forKeyword),
      paren(
        seqNonNull(
          variableDeclarationList(),
          skip1(semiColon),
          expr(),
          skip1(semiColon),
          expr()
        )
      ) as any,
      surrounded(
        terminated(str("{")),
        many1(
          furthest(
            continueStatement(),
            seqNonNull(breakKeyword, skip1(semiColon)),
            statement(),
            peekAnd(ifKeyword, lazy(ifStatement)),
            peekAnd(forKeyword, lazy(forLoop))
          )
        ),
        terminated(str("}"))
      ) as any
    ),
    (...args) => new ForStatement(...args)
  );

// const condition = toAST(SyntaxKind.IfCondition, terminated(paren(expr())));

/**
 *
 * TODO: Allow recursive
 */
export const ifStatement = (): Parser<unknown> =>
  map(
    seqNonNull(
      skip1(ifKeyword),
      terminated(paren(expr())),
      surrounded(
        terminated(str("{")),
        many1(
          any(
            statement(),
            peekAnd(ifKeyword, lazy(ifStatement)),
            peekAnd(forKeyword, lazy(forLoop))
          )
        ),
        terminated(str("}"))
      ) as any,
      ifPeek(
        skip1(elseKeyword),
        seqNonNull(
          ifPeek(ifKeyword, terminated(paren(expr()))),
          skipMany(trivia),
          surrounded(
            terminated(str("{")),
            many1(
              any(
                statement(),
                peekAnd(ifKeyword, lazy(ifStatement)),
                peekAnd(forKeyword, lazy(forLoop))
              )
            ),
            terminated(str("}"))
          ) as any
        )
      ) as any
    ),
    (...args) => new IfStatement(...args)
  );
