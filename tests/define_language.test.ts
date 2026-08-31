import { assertEquals } from "./assert.ts";
import { test } from "bun:test";
import {
  any,
  chainl1,
  either,
  many,
  seq,
  surrounded,
} from "../src/combinators.ts";
import { defineLanguage } from "../src/language.ts";
import type { Parser } from "../src/Parser.ts";
import { eof, number, regex, str } from "../src/parsers.ts";
import { map } from "../src/utility.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;

test("defineLanguage types sibling productions from an output schema", () => {
  type Grammar = {
    Literal: number;
    ShortLiteral: number;
    Inner: number;
    parser: number;
  };

  const Lang = defineLanguage<Grammar>({
    Literal: () => map(regex(/k/i, "k"), () => 1000),
    ShortLiteral: () => map(regex(/m/i, "m"), () => 1_000_000),
    Inner: ({ Literal, ShortLiteral }) =>
      map(seq(number(), either(Literal, ShortLiteral)), ([num, lit]) => {
        const numeric: number = lit;
        void numeric;

        // @ts-expect-error - lit must not degrade to unknown or any
        const text: string = lit;
        void text;

        return num * lit;
      }),
    parser: ({ Inner }) => Inner,
  });

  type _ = Assert<Equal<typeof Lang.Literal, Parser<number>>>;
  type __ = Assert<Equal<typeof Lang.Inner, Parser<number>>>;
  type ___ = Assert<Equal<typeof Lang.parser, Parser<number>>>;

  const result = Lang.parser({ text: "2k", index: 0 });
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.value, 2000);
    assertEquals(result.ctx.index, 2);
  }
});

test("defineLanguage supports forward and mutually-recursive productions", () => {
  type Expression = number | Expression[];
  type Grammar = {
    Expression: Expression;
    List: Expression[];
    Number: number;
  };

  const Lang = defineLanguage<Grammar>({
    Expression: ({ List, Number }) => any(List, Number),
    List: ({ Expression }) => surrounded(str("("), many(Expression), str(")")),
    Number: () => number(),
  });

  const result = Lang.Expression({ text: "(1(2))", index: 0 });
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.value, [1, [2]]);
    assertEquals(result.ctx.index, 6);
  }
});

test("defineLanguage builds a complete recursive expression grammar", () => {
  type Grammar = {
    File: number;
    Expression: number;
    AddOp: string;
    Term: number;
    MulOp: string;
    Factor: number;
  };

  const applyAdd = (left: number, op: string, right: number): number => {
    return op === "+" ? left + right : left - right;
  };
  const applyMul = (left: number, op: string, right: number): number => {
    return op === "*" ? left * right : left / right;
  };

  // Deliberately order definitions from entry point to leaves. Every forward
  // reference is available because definitions are bound lazily.
  const Lang = defineLanguage<Grammar>({
    File: ({ Expression }) => map(seq(Expression, eof()), ([value]) => value),
    Expression: ({ Term, AddOp }) => chainl1(Term, AddOp, applyAdd),
    AddOp: () => any(str("+"), str("-")),
    Term: ({ Factor, MulOp }) => chainl1(Factor, MulOp, applyMul),
    MulOp: () => any(str("*"), str("/")),
    Factor: ({ Expression }) =>
      any(surrounded(str("("), Expression, str(")")), number()),
  });

  const text = "2+3*4-(8/2)";
  const result = Lang.File({ text, index: 0 });
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.value, 10);
    assertEquals(result.ctx.index, text.length);
  }

  const failure = Lang.File({ text: "2+*3", index: 0 });
  assertEquals(failure.success, false);
});

test("defineLanguage initializes production parsers lazily", () => {
  let calls = 0;
  const Lang = defineLanguage<{ Value: string }>({
    Value: () => {
      calls++;
      return str("value");
    },
  });

  assertEquals(calls, 0);
  Lang.Value({ text: "value", index: 0 });
  Lang.Value({ text: "value", index: 0 });
  assertEquals(calls, 1);
});

test("defineLanguage rejects definitions with the wrong output type", () => {
  defineLanguage<{ Invalid: number }>({
    // @ts-expect-error - the schema requires Parser<number>
    Invalid: () => str("invalid"),
  });
});

test("defineLanguage requires the complete output schema", () => {
  // @ts-expect-error - Number is missing
  defineLanguage<{ Text: string; Number: number }>({
    Text: () => str("text"),
  });

  defineLanguage<{ Text: string }>({
    Text: (self) => {
      // @ts-expect-error - unknown productions are not available
      void self.Missing;
      return str("text");
    },
    // @ts-expect-error - Extra is not part of the schema
    Extra: () => str("extra"),
  });

  // Optional schema properties still describe productions and are required.
  // @ts-expect-error - Value is missing
  defineLanguage<{ Value?: string }>({});
});

test("defineLanguage binds symbol productions", () => {
  const Value = Symbol("Value");
  type Grammar = {
    [Value]: number;
  };

  const Lang = defineLanguage<Grammar>({
    [Value]: () => number(),
  });

  const result = Lang[Value]({ text: "42", index: 0 });
  assertEquals(result.success, true);
  if (result.success) assertEquals(result.value, 42);
});

test("defineLanguage safely binds special property names", () => {
  type Grammar = {
    __proto__: string;
  };

  const Lang = defineLanguage<Grammar>({
    ["__proto__"]: () => str("safe"),
  });

  assertEquals(Object.hasOwn(Lang, "__proto__"), true);
  const result = Lang.__proto__({ text: "safe", index: 0 });
  assertEquals(result.success, true);
});
