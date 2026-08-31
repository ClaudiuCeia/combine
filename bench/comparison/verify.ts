import { assert, assertAlmostEquals, assertStrictEquals } from "@std/assert";
import {
  expressionCases,
  invalidExpressionExamples,
  lateInvalidExpression,
  validExpressionExamples,
} from "./corpus.ts";
import { type BenchmarkAdapter, parseFailure } from "./types.ts";

export const verifyAdapter = (adapter: BenchmarkAdapter): void => {
  for (const testCase of [...validExpressionExamples, ...expressionCases]) {
    const result = adapter.parseExpression(testCase.input);
    assert(
      result !== parseFailure,
      `${adapter.name} rejected expression case ${testCase.name}`,
    );
    assertAlmostEquals(
      result,
      testCase.expected,
      1e-9,
      `${adapter.name} returned the wrong value for ${testCase.name}`,
    );
  }

  for (const input of invalidExpressionExamples) {
    assertStrictEquals(
      adapter.parseExpression(input),
      parseFailure,
      `${adapter.name} accepted invalid expression: ${JSON.stringify(input)}`,
    );
  }

  assertStrictEquals(
    adapter.parseExpression(lateInvalidExpression),
    parseFailure,
    `${adapter.name} accepted the late-invalid benchmark input`,
  );
};
