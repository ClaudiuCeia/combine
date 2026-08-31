import { failure, isPending, type Parser, type Result } from "./Parser.ts";

/** A single-use parser over append-only string chunks. */
export type StreamingParser<T> = Readonly<{
  /** Append input and parse the complete buffered prefix. */
  feed: (chunk: string) => Result<T>;
  /** Mark the buffered input as final and produce an authoritative result. */
  finish: () => Result<T>;
  /** Whether the parser has produced a definitive result. */
  readonly done: boolean;
}>;

/**
 * Create a buffered streaming parser.
 *
 * The grammar is rerun against the accumulated text after each feed. A
 * continuation-based engine can replace this implementation without changing
 * the public lifecycle.
 */
export const createStreamingParser = <T>(
  parser: Parser<T>,
): StreamingParser<T> => {
  let text = "";
  let done = false;
  let latest: Result<T> | undefined;

  return {
    feed: (chunk: string): Result<T> => {
      if (done) {
        throw new Error("cannot feed a completed streaming parser");
      }

      text += chunk;
      latest = parser({ text, index: 0, final: false });
      if (!isPending(latest)) done = true;
      return latest;
    },
    finish: (): Result<T> => {
      if (done && latest) return latest;

      latest = parser({ text, index: 0, final: true });
      done = true;

      if (isPending(latest)) {
        latest = failure(
          latest.ctx,
          latest.expected,
          latest.variants,
          latest.stack,
        );
      }

      return latest;
    },
    get done(): boolean {
      return done;
    },
  };
};

/** Parse an async chunk source until the parser reaches a definitive result. */
export async function* parseStream<T>(
  parser: Parser<T>,
  chunks: AsyncIterable<string>,
): AsyncGenerator<Result<T>, void, undefined> {
  const stream = createStreamingParser(parser);

  for await (const chunk of chunks) {
    if (chunk.length === 0) continue;

    const result = stream.feed(chunk);
    yield result;
    if (!isPending(result)) return;
  }

  yield stream.finish();
}
