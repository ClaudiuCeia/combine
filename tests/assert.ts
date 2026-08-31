import { expect } from "bun:test";

export const assertEquals = (actual: unknown, expected: unknown): void => {
  expect(actual).toEqual(expected);
};

export const assertStrictEquals = (
  actual: unknown,
  expected: unknown,
): void => {
  expect(actual).toBe(expected);
};

export const assertObjectMatch = (actual: unknown, expected: object): void => {
  expect(actual).toMatchObject(expected);
};
