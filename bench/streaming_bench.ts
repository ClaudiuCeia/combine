import { bench, group, run, summary } from "mitata";
import { manyTill, seq } from "../src/combinators.ts";
import { isPending, parseAll, type Result } from "../src/Parser.ts";
import { anyChar, str } from "../src/parsers.ts";
import { createStreamingParser } from "../src/streaming.ts";
import { map } from "../src/utility.ts";

const body = map(manyTill(anyChar(), str("\n```")), (parts) =>
  parts.slice(0, -1).join(""),
);
const codeBlock = map(seq(str("```txt\n"), body), ([, source]) => source);

const line = "export const answer = 42;\n";
const payload = line.repeat(Math.ceil((8 * 1024) / line.length));
const input = `\`\`\`txt\n${payload}\n\`\`\``;

const parseChunked = (chunkSize: number): string => {
  const stream = createStreamingParser(codeBlock);
  let result: Result<string> | undefined;

  for (let index = 0; index < input.length; index += chunkSize) {
    result = stream.feed(input.slice(index, index + chunkSize));
    if (!result.success && !isPending(result)) {
      throw new Error(result.expected);
    }
  }

  if (!result?.success) throw new Error("stream did not produce a code block");
  return result.value;
};

const finite = parseAll(codeBlock, input);
if (!finite.success || finite.value !== payload) {
  throw new Error("finite streaming benchmark fixture failed");
}

for (const chunkSize of [64, 512, input.length]) {
  if (parseChunked(chunkSize) !== payload) {
    throw new Error(`streaming benchmark fixture failed at ${chunkSize} bytes`);
  }
}

group("fenced code block (8 KiB)", () => {
  summary(() => {
    bench("finite input", () => parseAll(codeBlock, input)).baseline();
    bench("64 B chunks", () => parseChunked(64));
    bench("512 B chunks", () => parseChunked(512));
    bench("single chunk", () => parseChunked(input.length));
  });
});

await run({ throw: true });
