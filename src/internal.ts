import { type Context, ParserInvariantError } from "./Parser.ts";

export const assertAdvanced = (
  name: string,
  before: Context,
  after: Context,
): void => {
  if (!(after.index > before.index)) {
    throw new ParserInvariantError(
      `${name}: parser succeeded without consuming input (index ${before.index} -> ${after.index}; this would loop forever)`,
    );
  }
};

type SourceLocation = { line: number; column: number };

type LineCacheEntry = {
  starts: number[] | null;
  bytes: number;
};

const LINE_CACHE_MAX_BYTES = 64 * 1024;
const LINE_CACHE_ENTRY_OVERHEAD = 64;

export type LocationSession = {
  sourceLength: number;
  scannedTo: number;
  line: number;
  lineStart: number;
  reverseTo: number;
  reverseLine: number;
  reverseLineStart: number;
};

type ActiveLocationSession = Readonly<{
  session: LocationSession;
  source: string;
}>;

let activeLocationSession: ActiveLocationSession | undefined;
let lineCacheBytes = 0;
const lineStartsCache = new Map<string, LineCacheEntry>();

const normalizeIndex = (index: number, textLength: number): number => {
  let normalized = Number.isFinite(index) ? Math.trunc(index) : 0;
  if (normalized < 0) normalized = 0;
  if (normalized > textLength) normalized = textLength;
  return normalized;
};

const locationAt = (
  text: string,
  index: number,
  session: LocationSession | undefined,
): SourceLocation => {
  if (session && index < session.scannedTo && index <= session.reverseTo) {
    let line = session.reverseLine;
    let lineStart = session.reverseLineStart;

    while (index < lineStart) {
      line--;
      let previousNewline = lineStart - 2;
      while (previousNewline >= 0 && text.charCodeAt(previousNewline) !== 10) {
        previousNewline--;
      }
      lineStart = previousNewline + 1;
    }

    session.reverseTo = index;
    session.reverseLine = line;
    session.reverseLineStart = lineStart;
    return { line, column: index - lineStart + 1 };
  }

  let line = 1;
  let lineStart = 0;
  let start = 0;

  if (session && index >= session.scannedTo) {
    line = session.line;
    lineStart = session.lineStart;
    start = session.scannedTo;
  }

  for (let i = start; i < index; i++) {
    if (text.charCodeAt(i) === 10 /* '\n' */) {
      line++;
      lineStart = i + 1;
    }
  }

  if (session && index > session.scannedTo) {
    session.scannedTo = index;
    session.line = line;
    session.lineStart = lineStart;
    session.reverseTo = index;
    session.reverseLine = line;
    session.reverseLineStart = lineStart;
  }

  return { line, column: index - lineStart + 1 };
};

const cachedLocationAt = (
  text: string,
  index: number,
): SourceLocation | undefined => {
  let entry = lineStartsCache.get(text);
  if (entry?.starts === null) return undefined;

  if (!entry) {
    const sourceBytes = LINE_CACHE_ENTRY_OVERHEAD + text.length * 2;
    if (sourceBytes > LINE_CACHE_MAX_BYTES) {
      return undefined;
    }

    const starts = [0];
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10 /* '\n' */) starts.push(i + 1);
    }

    const bytes = sourceBytes + starts.length * 8;
    entry = {
      starts: bytes <= LINE_CACHE_MAX_BYTES ? starts : null,
      bytes: bytes <= LINE_CACHE_MAX_BYTES ? bytes : sourceBytes,
    };

    while (lineCacheBytes + entry.bytes > LINE_CACHE_MAX_BYTES) {
      const oldest = lineStartsCache.entries().next().value as
        | [string, LineCacheEntry]
        | undefined;
      if (!oldest) break;
      lineStartsCache.delete(oldest[0]);
      lineCacheBytes -= oldest[1].bytes;
    }

    lineStartsCache.set(text, entry);
    lineCacheBytes += entry.bytes;
    if (entry.starts === null) return undefined;
  }

  let lo = 0;
  let hi = entry.starts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (entry.starts[mid]! <= index) lo = mid + 1;
    else hi = mid;
  }

  const line = lo;
  const lineStart = entry.starts[line - 1] ?? 0;
  return { line, column: index - lineStart + 1 };
};

export const createLocationSession = (): LocationSession => ({
  sourceLength: 0,
  scannedTo: 0,
  line: 1,
  lineStart: 0,
  reverseTo: 0,
  reverseLine: 1,
  reverseLineStart: 0,
});

export const withLocationSession = <T>(
  session: LocationSession,
  source: string,
  run: () => T,
): T => {
  const previous = activeLocationSession;
  if (source.length < session.sourceLength) {
    session.scannedTo = 0;
    session.line = 1;
    session.lineStart = 0;
  }
  session.sourceLength = source.length;
  session.reverseTo = session.scannedTo;
  session.reverseLine = session.line;
  session.reverseLineStart = session.lineStart;
  activeLocationSession = { session, source };
  try {
    return run();
  } finally {
    activeLocationSession = previous;
  }
};

export const getContextLocation = (ctx: Context): SourceLocation => {
  const index = normalizeIndex(ctx.index, ctx.text.length);
  if (activeLocationSession?.source === ctx.text) {
    return locationAt(ctx.text, index, activeLocationSession.session);
  }
  return (
    cachedLocationAt(ctx.text, index) ?? locationAt(ctx.text, index, undefined)
  );
};

export const createDiagnosticLocation = (ctx: Context): SourceLocation => {
  const index = normalizeIndex(ctx.index, ctx.text.length);
  if (index === 0) return { line: 1, column: 1 };
  if (activeLocationSession?.source === ctx.text) {
    return locationAt(ctx.text, index, activeLocationSession.session);
  }
  return (
    cachedLocationAt(ctx.text, index) ?? locationAt(ctx.text, index, undefined)
  );
};

export const preserveContextFinality = (
  session: Context,
  returned: Context,
): Context => {
  if (session.final === returned.final) return returned;

  return session.final === undefined
    ? { text: returned.text, index: returned.index }
    : { text: returned.text, index: returned.index, final: session.final };
};
