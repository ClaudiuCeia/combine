import { expect, test } from "bun:test";
import { assert } from "../src/internal_assert.ts";

test("internal assert throws its default and custom messages", () => {
  expect(() => assert(false)).toThrow("Assertion failed");
  expect(() => assert(false, "broken invariant")).toThrow("broken invariant");
});
