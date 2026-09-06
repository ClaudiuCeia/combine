import { expect, test } from "bun:test";
import {
  any,
  anyChar,
  createStreamingParser,
  eof,
  eol,
  formatErrorReport,
  isPending,
  many,
  manyTill,
  map,
  parseAll,
  seq,
  str,
  trie,
} from "../mod.ts";
import { parseQuery } from "../examples/query.ts";

const horizontalSpace = any(str(" "), str("\t"));
const closingFence = map(
  seq(str("```"), many(horizontalSpace), any(eol(), eof())),
  () => "```",
);
const codeLine = map(manyTill(anyChar(), eol()), (parts) => parts.join(""));
const fencedTypeScript = map(
  seq(str("```ts"), eol(), manyTill(codeLine, closingFence)),
  ([, , lines]) => lines.slice(0, -1).join(""),
);

test("README delimiter grammar parses finite and streamed input", () => {
  const delimiter = trie(["$", "$$"]);

  const finite = parseAll(delimiter, "$$");
  expect(finite.success && finite.value).toBe("$$");

  const stream = createStreamingParser(delimiter);
  expect(isPending(stream.feed("$"))).toBe(true);

  const complete = stream.feed("$");
  expect(complete.success && complete.value).toBe("$$");
});

test("README fenced block stays pending until its closing fence", () => {
  const block = createStreamingParser(fencedTypeScript);
  expect(isPending(block.feed("```ts\nconst answer = 42;\n``"))).toBe(true);

  const complete = block.feed("`\n");
  expect(complete.success && complete.value).toBe("const answer = 42;\n");
});

test("README fenced block ignores backticks inside a code line", () => {
  const block = createStreamingParser(fencedTypeScript);
  expect(isPending(block.feed('```ts\nconst marker = "```";\n``'))).toBe(true);

  const complete = block.feed("`\n");
  expect(complete.success && complete.value).toBe('const marker = "```";\n');
});

test("README fenced block rejects a closing-fence prefix with a suffix", () => {
  const block = createStreamingParser(fencedTypeScript);
  expect(isPending(block.feed("```ts\n```suffix\n"))).toBe(true);

  const complete = block.feed("```\n");
  expect(complete.success && complete.value).toBe("```suffix\n");
});

test("README fenced block accepts CRLF line endings", () => {
  const block = createStreamingParser(fencedTypeScript);
  const complete = block.feed("```ts\r\nconst answer = 42;\r\n```\r\n");

  expect(complete.success && complete.value).toBe("const answer = 42;\r\n");
});

test("README query grammar returns a typed precedence tree", () => {
  const result = parseQuery(
    'status:open AND (owner:"Jane Doe" OR priority:high)',
  );

  expect(result.success && result.value).toEqual({
    kind: "and",
    left: { kind: "predicate", field: "status", value: "open" },
    right: {
      kind: "or",
      left: { kind: "predicate", field: "owner", value: "Jane Doe" },
      right: { kind: "predicate", field: "priority", value: "high" },
    },
  });
});

test("README query grammar gives AND precedence over OR", () => {
  const result = parseQuery("a:b OR c:d AND e:f");

  expect(result.success && result.value).toEqual({
    kind: "or",
    left: { kind: "predicate", field: "a", value: "b" },
    right: {
      kind: "and",
      left: { kind: "predicate", field: "c", value: "d" },
      right: { kind: "predicate", field: "e", value: "f" },
    },
  });
});

test("README query grammar folds repeated operators to the left", () => {
  const result = parseQuery("a:b OR c:d OR e:f");

  expect(result.success && result.value).toEqual({
    kind: "or",
    left: {
      kind: "or",
      left: { kind: "predicate", field: "a", value: "b" },
      right: { kind: "predicate", field: "c", value: "d" },
    },
    right: { kind: "predicate", field: "e", value: "f" },
  });
});

test("README query grammar accepts empty quoted values", () => {
  const result = parseQuery('field:""');
  expect(result.success && result.value).toEqual({
    kind: "predicate",
    field: "field",
    value: "",
  });
});

test("README query error output is produced by formatErrorReport", () => {
  const result = parseQuery("status:open AND owner:");
  expect(result.success).toBe(false);

  if (!result.success) {
    expect(result.fatal).toBe(true);
    expect(formatErrorReport(result)).toBe(
      [
        "expected value after ':' at line 1, column 23",
        "1 | status:open AND owner:",
        "  |                       ^",
        "  in predicate at line 1, column 17",
        "  in expression at line 1, column 17",
        "  in query at line 1, column 1",
      ].join("\n"),
    );
  }
});
