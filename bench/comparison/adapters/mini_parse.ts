// mini-parse 0.6.41 declares dist/index.d.ts but omits it from the npm tarball.
import {
  delimited,
  eof,
  fn,
  or,
  repeat,
  repeatPlus,
  seq,
  terminated,
  text,
} from "mini-parse";
import { type BenchmarkAdapter, parseFailure } from "../types.ts";

type MiniParser<T> = Readonly<{
  parse: (input: { stream: unknown }) => { value: T } | null;
  map: <U>(mapper: (value: T) => U) => MiniParser<U>;
}>;

class CharacterStream {
  readonly src: string;
  #position = 0;

  constructor(input: string) {
    this.src = input;
  }

  checkpoint(): number {
    return this.#position;
  }

  reset(position: number): void {
    this.#position = position;
  }

  nextToken(): unknown {
    if (this.#position >= this.src.length) return null;
    const start = this.#position;
    const character = this.src[this.#position++]!;
    return {
      kind: "character",
      text: character,
      span: [start, this.#position],
    };
  }
}

const createExpressionParser = (): MiniParser<number> => {
  const whitespace = repeat(or(" ", "\t", "\r", "\n"));
  const lexeme = <T>(parser: MiniParser<T>): MiniParser<T> =>
    seq(parser, whitespace).map(([value]: [T, string[]]) => value);
  const symbol = (value: string): MiniParser<string> => lexeme(text(value));
  const digit = or(..."0123456789".split("")) as MiniParser<string>;
  const integer = lexeme(
    repeatPlus(digit).map((digits: string[]) => Number(digits.join(""))),
  );

  const grammar: { expression?: MiniParser<number> } = {};
  const expressionRef = fn(() => grammar.expression!);
  const factor = or(
    integer,
    delimited(symbol("("), expressionRef, symbol(")")),
  );
  const product = seq(
    factor,
    repeat(seq(or(symbol("*"), symbol("/")), factor)),
  ).map(([head, tail]: [number, [string, number][]]) =>
    tail.reduce(
      (left, [operator, right]) =>
        operator === "*" ? left * right : left / right,
      head,
    )
  );
  grammar.expression = seq(
    product,
    repeat(seq(or(symbol("+"), symbol("-")), product)),
  ).map(([head, tail]: [number, [string, number][]]) =>
    tail.reduce(
      (left, [operator, right]) =>
        operator === "+" ? left + right : left - right,
      head,
    )
  );

  return seq(whitespace, terminated(grammar.expression, eof())).map(
    ([, value]: [string[], number]) => value,
  );
};

const run = <T>(
  parser: MiniParser<T>,
  input: string,
): T | typeof parseFailure => {
  const result = parser.parse({ stream: new CharacterStream(input) });
  return result === null ? parseFailure : result.value;
};

export const createMiniParseAdapter = (): BenchmarkAdapter => {
  const expression = createExpressionParser();

  return {
    name: "mini-parse",
    parseExpression: (input) => run(expression, input),
  };
};
