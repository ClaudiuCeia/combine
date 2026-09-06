import {
  any,
  chainl1,
  context,
  createLexer,
  cut,
  defineLanguage,
  map,
  parseAll,
  regex,
  seq,
  str,
  type Result,
} from "../mod.ts";

export type Query =
  | Readonly<{ kind: "predicate"; field: string; value: string }>
  | Readonly<{
      kind: "and" | "or";
      left: Query;
      right: Query;
    }>;

const lexer = createLexer();
const field = lexer.lexeme(regex(/[A-Za-z][A-Za-z0-9_-]*/, "field"));
const quotedValue = lexer.lexeme(
  map(
    seq(str('"'), regex(/[^"]*/, "quoted value"), cut(str('"'))),
    ([, value]) => value,
  ),
);
const bareValue = lexer.lexeme(regex(/[A-Za-z0-9_-]+/, "value"));

const predicate = context(
  "in predicate",
  map(
    seq(
      field,
      lexer.symbol(":"),
      cut(any(quotedValue, bareValue), "value after ':'"),
    ),
    ([field, , value]) => ({ kind: "predicate", field, value }) as const,
  ),
);

type QueryProductions = {
  Primary: Query;
  And: Query;
  Expression: Query;
  File: Query;
};

const QueryGrammar = defineLanguage<QueryProductions>({
  Primary: ({ Expression }) =>
    context(
      "in expression",
      any(
        predicate,
        map(
          seq(lexer.symbol("("), Expression, cut(lexer.symbol(")"))),
          ([, expression]) => expression,
        ),
      ),
    ),
  And: ({ Primary }) =>
    chainl1(Primary, lexer.keyword("AND"), (left, _operator, right) => ({
      kind: "and",
      left,
      right,
    })),
  Expression: ({ And }) =>
    chainl1(And, lexer.keyword("OR"), (left, _operator, right) => ({
      kind: "or",
      left,
      right,
    })),
  File: ({ Expression }) =>
    context(
      "in query",
      map(seq(lexer.trivia, Expression), ([, expression]) => expression),
    ),
});

export const parseQuery = (input: string): Result<Query> =>
  parseAll(QueryGrammar.File, input);

if (import.meta.main) {
  const result = parseQuery(
    'status:open AND (owner:"Jane Doe" OR priority:high)',
  );
  console.log(result.success ? result.value : result.expected);
}
