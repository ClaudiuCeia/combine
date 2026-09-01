import { failure, isPending, type Parser, type Result } from "./Parser.ts";
import { eof } from "./parsers.ts";

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
  const initial = stream.feed("");

  if (!isPending(initial)) {
    yield initial;
    return;
  }

  for await (const chunk of chunks) {
    if (chunk.length === 0) continue;

    const result = stream.feed(chunk);
    yield result;
    if (!isPending(result)) return;
  }

  yield stream.finish();
}

export type ParseStreamEachOptions = Readonly<{
  /** Parser that marks a clean end between values. Default: `eof()`. */
  until?: Parser<unknown>;
}>;

/** Parse and yield consecutive values from one async chunk source. */
export async function* parseStreamEach<T>(
  parser: Parser<T>,
  chunks: AsyncIterable<string>,
  options: ParseStreamEachOptions = {},
): AsyncGenerator<Result<T>, void, undefined> {
  const until = options.until ?? eof();
  let text = "";
  let index = 0;

  const compactConsumed = (): void => {
    if (index === 0) return;
    text = text.substring(index);
    index = 0;
  };

  function* parseAvailable(
    final: boolean,
  ): Generator<Result<T>, boolean, undefined> {
    while (true) {
      const ctx = { text, index, final };
      const end = until(ctx);
      if (end.success) return true;
      if (isPending(end)) {
        if (!final && index >= text.length) return false;
        yield final
          ? failure(end.ctx, end.expected, end.variants, end.stack)
          : end;
        return final;
      }
      if (end.fatal) {
        yield end;
        return true;
      }
      if (index >= text.length) {
        if (final && options.until !== undefined) yield end;
        return final;
      }

      const result = parser(ctx);
      if (!result.success) {
        if (final && isPending(result)) {
          yield failure(
            result.ctx,
            result.expected,
            result.variants,
            result.stack,
          );
        } else {
          yield result;
        }
        return !isPending(result) || final;
      }

      if (result.ctx.index <= index) {
        yield failure(
          ctx,
          "parseStreamEach: parser succeeded without consuming input",
        );
        return true;
      }

      index = result.ctx.index;
      yield result;
    }
  }

  const initialEnd = until({ text, index, final: false });
  if (initialEnd.success) return;
  if (initialEnd.fatal) {
    yield initialEnd;
    return;
  }

  for await (const chunk of chunks) {
    if (chunk.length === 0) continue;
    text += chunk;

    const batch = parseAvailable(false);
    let next = batch.next();
    while (!next.done) {
      yield next.value;
      next = batch.next();
    }
    if (next.value) return;
    compactConsumed();
  }

  const batch = parseAvailable(true);
  let next = batch.next();
  while (!next.done) {
    yield next.value;
    next = batch.next();
  }
}
