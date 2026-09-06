import {
  type Failure,
  failure,
  isPending,
  type Parser,
  type Result,
} from "./Parser.ts";
import {
  assertAdvanced,
  createLocationSession,
  withLocationSession,
} from "./internal.ts";
import { eof } from "./parsers.ts";

const DEFAULT_MAX_BUFFER_LENGTH = 1024 * 1024;

export type StreamingParserOptions = Readonly<{
  /** Maximum retained UTF-16 code units. Default: 1,048,576. */
  maxBufferLength?: number;
}>;

const resolveMaxBufferLength = (value: number | undefined): number => {
  const limit = value ?? DEFAULT_MAX_BUFFER_LENGTH;
  if (
    limit !== Number.POSITIVE_INFINITY &&
    (!Number.isSafeInteger(limit) || limit < 0)
  ) {
    throw new RangeError(
      "maxBufferLength must be a non-negative safe integer or Infinity",
    );
  }
  return limit;
};

const bufferLimitFailure = (
  text: string,
  final: boolean,
  maxBufferLength: number,
): Failure => {
  return failure(
    { text, index: text.length, final },
    `stream buffer limit of ${maxBufferLength} UTF-16 code units exceeded`,
  );
};

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
  options: StreamingParserOptions = {},
): StreamingParser<T> => {
  const maxBufferLength = resolveMaxBufferLength(options.maxBufferLength);
  const locationSession = createLocationSession();
  let text = "";
  let done = false;
  let latest: Result<T> | undefined;

  return {
    feed: (chunk: string): Result<T> => {
      if (done) {
        throw new Error("cannot feed a completed streaming parser");
      }

      if (chunk.length > maxBufferLength - text.length) {
        latest = withLocationSession(locationSession, text, () =>
          bufferLimitFailure(text, false, maxBufferLength),
        );
        done = true;
        return latest;
      }

      text += chunk;
      latest = withLocationSession(locationSession, text, () =>
        parser({ text, index: 0, final: false }),
      );
      if (!isPending(latest)) done = true;
      return latest;
    },
    finish: (): Result<T> => {
      if (done && latest) return latest;

      latest = withLocationSession(locationSession, text, () =>
        parser({ text, index: 0, final: true }),
      );
      done = true;

      if (isPending(latest)) {
        const pendingResult = latest;
        latest = withLocationSession(locationSession, text, () =>
          failure(
            pendingResult.ctx,
            pendingResult.expected,
            pendingResult.variants,
            pendingResult.stack,
          ),
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
  options: StreamingParserOptions = {},
): AsyncGenerator<Result<T>, void, undefined> {
  const stream = createStreamingParser(parser, options);
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

export type ParseStreamEachOptions = StreamingParserOptions &
  Readonly<{
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
  const maxBufferLength = resolveMaxBufferLength(options.maxBufferLength);
  let locationSession = createLocationSession();
  let text = "";
  let index = 0;

  const compactConsumed = (): void => {
    if (index === 0) return;
    text = text.substring(index);
    index = 0;
    locationSession = createLocationSession();
  };

  function* parseAvailable(
    final: boolean,
  ): Generator<Result<T>, boolean, undefined> {
    while (true) {
      const ctx = { text, index, final };
      const end = withLocationSession(locationSession, text, () => until(ctx));
      if (end.success) return true;
      if (isPending(end)) {
        if (!final && index >= text.length) return false;
        yield final
          ? withLocationSession(locationSession, text, () =>
              failure(end.ctx, end.expected, end.variants, end.stack),
            )
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

      const result = withLocationSession(locationSession, text, () =>
        parser(ctx),
      );
      if (!result.success) {
        if (final && isPending(result)) {
          yield withLocationSession(locationSession, text, () =>
            failure(result.ctx, result.expected, result.variants, result.stack),
          );
        } else {
          yield result;
        }
        return !isPending(result) || final;
      }

      assertAdvanced("parseStreamEach", ctx, result.ctx);

      index = result.ctx.index;
      yield result;
    }
  }

  const initialEnd = withLocationSession(locationSession, text, () =>
    until({ text, index, final: false }),
  );
  if (initialEnd.success) return;
  if (initialEnd.fatal) {
    yield initialEnd;
    return;
  }

  for await (const chunk of chunks) {
    if (chunk.length === 0) continue;

    if (chunk.length > maxBufferLength - text.length) {
      yield withLocationSession(locationSession, text, () =>
        bufferLimitFailure(text, false, maxBufferLength),
      );
      return;
    }

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
