import { expect, test } from "bun:test";
import { manyTill, seq } from "../src/combinators.ts";
import { isPending, type Parser, type Result } from "../src/Parser.ts";
import { anyChar, eol, str } from "../src/parsers.ts";
import { parseStreamEach } from "../src/streaming.ts";
import { map } from "../src/utility.ts";

type CodeBlock = Readonly<{
  name: string;
  frontmatter: string | null;
  body: string;
}>;

const textUntil = (end: Parser<unknown>): Parser<string> =>
  map(manyTill(anyChar(), end), (parts) => parts.slice(0, -1).join(""));

const codeLine = map(
  manyTill(anyChar(), eol()),
  (parts) => parts.slice(0, -1).join("") + parts.at(-1),
);

const splitFrontmatter = (name: string, source: string): CodeBlock => {
  if (!name.endsWith(".md") || !source.startsWith("---\n")) {
    return { name, frontmatter: null, body: source };
  }

  const end = source.indexOf("\n---\n", 4);
  if (end === -1) return { name, frontmatter: null, body: source };

  return {
    name,
    frontmatter: source.slice(4, end),
    body: source.slice(end + 5),
  };
};

const codeBlock: Parser<CodeBlock> = map(
  seq(
    textUntil(str("```")),
    textUntil(eol()),
    map(manyTill(codeLine, str("```")), (parts) => parts.slice(0, -1).join("")),
  ),
  ([, name, body]) => splitFrontmatter(name, body),
);

test("stream LLM-style fenced files with Markdown frontmatter", async () => {
  const chunks = [
    "Here are the files:\n\n`",
    "``src/ind",
    "ex.ts\nexport const ",
    "answer = 4",
    "2;\n`",
    "``\n\nAnd the documentation:\n\n``",
    "`README.",
    "md\n--",
    "-\ntitle: Streaming ",
    "parser\ntags:\n  - parser\n",
    "  - llm\n---",
    "\n# Streaming\n\nUse `parse",
    "StreamEach`.\n`",
    "``",
  ] as const;

  let deliveredChunks = 0;
  async function* source(): AsyncGenerator<string> {
    for (const chunk of chunks) {
      deliveredChunks++;
      yield chunk;
    }
  }

  const emitted: { block: CodeBlock; afterChunk: number }[] = [];
  const results: Result<CodeBlock>[] = [];
  for await (const result of parseStreamEach(codeBlock, source())) {
    results.push(result);
    if (result.success) {
      emitted.push({ block: result.value, afterChunk: deliveredChunks });
    }
  }

  expect(emitted).toEqual([
    {
      block: {
        name: "src/index.ts",
        frontmatter: null,
        body: "export const answer = 42;\n",
      },
      afterChunk: 6,
    },
    {
      block: {
        name: "README.md",
        frontmatter: "title: Streaming parser\ntags:\n  - parser\n  - llm",
        body: "# Streaming\n\nUse `parseStreamEach`.\n",
      },
      afterChunk: 14,
    },
  ]);
  expect(results.some(isPending)).toBe(true);
  expect(results.at(-1)?.success).toBe(true);
});
