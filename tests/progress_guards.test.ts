import { expect, test } from "bun:test";
import {
  any,
  chainl1,
  chainr1,
  many,
  manyTill,
  optional,
  sepBy,
  sepBy1,
} from "../src/combinators.ts";
import { type Parser, ParserInvariantError, success } from "../src/Parser.ts";
import { str } from "../src/parsers.ts";
import { attempt } from "../src/utility.ts";

const epsilon = <T>(value: T): Parser<T> => {
  return (ctx) => success(ctx, value);
};

test("many fails fast on non-advancing parser", () => {
  const p = many(epsilon("x"));
  expect(() => p({ text: "abc", index: 0 })).toThrow(ParserInvariantError);
  expect(() => p({ text: "abc", index: 0 })).toThrow("many");
});

test("manyTill fails fast on non-advancing parser when end never matches", () => {
  const p = manyTill(epsilon("x"), str("END"));
  expect(() => p({ text: "abc", index: 0 })).toThrow(ParserInvariantError);
  expect(() => p({ text: "abc", index: 0 })).toThrow("manyTill");
});

test("sepBy fails fast on non-advancing element parser", () => {
  const p = sepBy(epsilon("x"), str(","));
  expect(() => p({ text: "abc", index: 0 })).toThrow(ParserInvariantError);
  expect(() => p({ text: "abc", index: 0 })).toThrow("sepBy");
});

test("sepBy fails fast on non-advancing separator parser", () => {
  const p = sepBy(str("x"), epsilon(","));
  expect(() => p({ text: "x", index: 0 })).toThrow(ParserInvariantError);
  expect(() => p({ text: "x", index: 0 })).toThrow("sepBy");
});

test("sepBy fails fast on a non-advancing subsequent element", () => {
  const element = any(str("a"), epsilon("a"));
  const p = sepBy(element, str(","));
  expect(() => p({ text: "a,", index: 0 })).toThrow(ParserInvariantError);
  expect(() => p({ text: "a,", index: 0 })).toThrow("sepBy");
});

test("sepBy1 fails fast on a non-advancing first element", () => {
  const p = sepBy1(epsilon("a"), str(","));
  expect(() => p({ text: "", index: 0 })).toThrow(ParserInvariantError);
  expect(() => p({ text: "", index: 0 })).toThrow("sepBy1");
});

test("chainl1 fails fast on non-advancing op/term loop", () => {
  const p = chainl1(epsilon(1), epsilon("+"), (l) => l);
  expect(() => p({ text: "abc", index: 0 })).toThrow(ParserInvariantError);
  expect(() => p({ text: "abc", index: 0 })).toThrow("chainl1");
});

test("chainr1 fails fast on non-advancing op/term loop", () => {
  const p = chainr1(epsilon(1), epsilon("+"), (l) => l);
  expect(() => p({ text: "abc", index: 0 })).toThrow(ParserInvariantError);
  expect(() => p({ text: "abc", index: 0 })).toThrow("chainr1");
});

test("chain combinators fail fast on a non-advancing operator", () => {
  for (const parser of [
    chainl1(str("a"), epsilon("+"), (left) => left),
    chainr1(str("a"), epsilon("+"), (left) => left),
  ]) {
    expect(() => parser({ text: "a", index: 0 })).toThrow(ParserInvariantError);
    expect(() => parser({ text: "a", index: 0 })).toThrow("chain");
  }
});

test("chain combinators fail fast on a non-advancing right term", () => {
  const term = any(str("a"), epsilon("a"));
  for (const parser of [
    chainl1(term, str("+"), (left) => left),
    chainr1(term, str("+"), (left) => left),
  ]) {
    expect(() => parser({ text: "a+", index: 0 })).toThrow(
      ParserInvariantError,
    );
    expect(() => parser({ text: "a+", index: 0 })).toThrow("chain");
  }
});

test("backtracking combinators cannot swallow parser invariant errors", () => {
  const invalid = many(epsilon("x"));
  const parsers: Parser<unknown>[] = [
    many(invalid),
    optional(invalid),
    any(invalid, str("")),
    attempt(invalid),
  ];

  for (const parser of parsers) {
    expect(() => parser({ text: "", index: 0 })).toThrow(ParserInvariantError);
  }
});
