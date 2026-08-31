import { assertEquals } from "./assert.ts";
import { test } from "bun:test";
import {
  any,
  chainl1,
  chainr1,
  many,
  manyTill,
  sepBy,
  sepBy1,
} from "../src/combinators.ts";
import type { Parser } from "../src/Parser.ts";
import { success } from "../src/Parser.ts";
import { str } from "../src/parsers.ts";

const epsilon = <T>(value: T): Parser<T> => {
  return (ctx) => success(ctx, value);
};

test("many fails fast on non-advancing parser", () => {
  const p = many(epsilon("x"));
  const res = p({ text: "abc", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected.includes("many"), true);
});

test("manyTill fails fast on non-advancing parser when end never matches", () => {
  const p = manyTill(epsilon("x"), str("END"));
  const res = p({ text: "abc", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected.includes("manyTill"), true);
});

test("sepBy fails fast on non-advancing element parser", () => {
  const p = sepBy(epsilon("x"), str(","));
  const res = p({ text: "abc", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected.includes("sepBy"), true);
});

test("sepBy fails fast on non-advancing separator parser", () => {
  const p = sepBy(str("x"), epsilon(","));
  const res = p({ text: "x", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected.includes("sepBy"), true);
});

test("sepBy fails fast on a non-advancing subsequent element", () => {
  const element = any(str("a"), epsilon("a"));
  const res = sepBy(element, str(","))({ text: "a,", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected.includes("sepBy"), true);
});

test("sepBy1 fails fast on a non-advancing first element", () => {
  const res = sepBy1(epsilon("a"), str(","))({ text: "", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected.includes("sepBy1"), true);
});

test("chainl1 fails fast on non-advancing op/term loop", () => {
  const p = chainl1(epsilon(1), epsilon("+"), (l) => l);
  const res = p({ text: "abc", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected.includes("chainl1"), true);
});

test("chainr1 fails fast on non-advancing op/term loop", () => {
  const p = chainr1(epsilon(1), epsilon("+"), (l) => l);
  const res = p({ text: "abc", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) assertEquals(res.expected.includes("chainr1"), true);
});

test("chain combinators fail fast on a non-advancing operator", () => {
  for (const parser of [
    chainl1(str("a"), epsilon("+"), (left) => left),
    chainr1(str("a"), epsilon("+"), (left) => left),
  ]) {
    const res = parser({ text: "a", index: 0 });
    assertEquals(res.success, false);
    if (!res.success) assertEquals(res.expected.includes("chain"), true);
  }
});

test("chain combinators fail fast on a non-advancing right term", () => {
  const term = any(str("a"), epsilon("a"));
  for (const parser of [
    chainl1(term, str("+"), (left) => left),
    chainr1(term, str("+"), (left) => left),
  ]) {
    const res = parser({ text: "a+", index: 0 });
    assertEquals(res.success, false);
    if (!res.success) assertEquals(res.expected.includes("chain"), true);
  }
});
