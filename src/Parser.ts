/**
 * A parser consumes input from a `Context` and returns either a `Success<T>` or
 * `Failure`.
 */
export type Parser<T> = (ctx: Context) => Result<T>;

/**
 * Parsing context (input + current offset).
 */
export type Context = Readonly<{
  text: string;
  index: number;
}>;

/**
 * Result of running a parser.
 */
export type Result<T> = Success<T> | Failure;

/**
 * Successful parse result (value + updated context).
 */
export type Success<T> = Readonly<{
  success: true;
  value: T;
  ctx: Context;
}>;

/**
 * A single frame in an error stack trace.
 * Similar to how TypeScript traces type errors through nested structures.
 */
export type ErrorFrame = Readonly<{
  /** Human-readable context label (e.g., "in match expression", "in function body") */
  label: string;
  /** Location where this context started */
  location: {
    line: number;
    column: number;
  };
}>;

/**
 * Failed parse result.
 *
 * - `expected` is the immediate expected token/message.
 * - `stack` is a causation trace built via `context(...)`.
 * - `fatal` indicates a committed failure (from `cut(...)`) that should not be
 *   swallowed by backtracking combinators.
 */
export type Failure = Readonly<{
  success: false;
  /** The immediate expected value/token */
  expected: string;
  ctx: Context;
  location: {
    line: number;
    column: number;
  };
  /** Alternative parse attempts at the same position */
  variants: Failure[];
  /**
   * Error causation stack - traces back through parser hierarchy.
   * First element is the most immediate cause, last is the root context.
   * Example: ["expected identifier", "in field declaration", "in viewer block"]
   */
  stack: ErrorFrame[];
  /** If true, this error should not be caught by alternative parsers (committed parse) */
  fatal: boolean;
}>;

export const success = <T>(ctx: Context, value: T): Success<T> => {
  return {
    success: true,
    value,
    ctx,
  };
};

/**
 * Compute line and column from context
 */
export const getLocation = (ctx: Context): { line: number; column: number } => {
  const text = ctx.text;
  const textLength = text.length;

  let index = Number.isFinite(ctx.index) ? Math.trunc(ctx.index) : 0;
  if (index < 0) index = 0;
  if (index > textLength) index = textLength;

  const parsedCtx = text.slice(0, index);
  const parsedLines = parsedCtx.split("\n");
  const line = parsedLines.length;

  // `split` always returns at least one element, but keep a safe fallback.
  const lastLine = parsedLines[parsedLines.length - 1] ?? "";
  const column = lastLine.length + 1;

  return { line, column };
};

export const failure = (
  ctx: Context,
  expected: string,
  variants: Failure[] = [],
  stack: ErrorFrame[] = [],
  fatal = false,
): Failure => {
  const location = getLocation(ctx);

  return {
    success: false,
    expected,
    ctx,
    location,
    variants,
    stack,
    fatal,
  };
};

/**
 * Create a fatal failure that will not be caught by alternative parsers.
 * Use after a "point of no return" - when enough has been parsed to commit
 * to this branch of the grammar.
 */
export const fatalFailure = (
  ctx: Context,
  expected: string,
  stack: ErrorFrame[] = [],
): Failure => {
  return failure(ctx, expected, [], stack, true);
};

/**
 * Add a context frame to an existing failure's stack.
 * This creates the "in X" chain in error messages.
 */
export const pushFrame = (
  f: Failure,
  label: string,
  ctx?: Context,
): Failure => {
  const location = ctx ? getLocation(ctx) : f.location;
  const frame: ErrorFrame = {
    label,
    location,
  };
  return {
    ...f,
    stack: [...f.stack, frame],
  };
};

/**
 * Check if a failure is fatal (committed parse that should propagate)
 */
export const isFatal = (f: Failure): boolean => f.fatal;

/**
 * Format an error stack into a human-readable string.
 * Produces output similar to TypeScript's type error traces.
 *
 * Example output:
 * ```
 * expected '}' at line 5, column 3
 *   in viewer declaration at line 2, column 1
 *   in program
 * ```
 */
export const formatErrorStack = (f: Failure): string => {
  const lines: string[] = [];

  // Primary error message
  lines.push(
    `expected ${f.expected} at line ${f.location.line}, column ${f.location.column}`,
  );

  // Stack frames (indented)
  for (const frame of f.stack) {
    lines.push(
      `  ${frame.label} at line ${frame.location.line}, column ${frame.location.column}`,
    );
  }

  return lines.join("\n");
};

/**
 * Get a compact single-line error message
 */
export const formatErrorCompact = (f: Failure): string => {
  const context = f.stack.length > 0 ? ` (${f.stack[0].label})` : "";
  return `expected ${f.expected}${context} at ${f.location.line}:${f.location.column}`;
};

const expandTabs = (s: string, tabWidth: number): string => {
  if (tabWidth <= 0) return s;
  return s.replaceAll("\t", " ".repeat(tabWidth));
};

const ansi = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
};

export type FormatErrorSnippetOptions = Readonly<{
  /** Include N lines before and after the error line. Default: 1 */
  contextLines?: number;
  /** Expand tabs to this many spaces. Default: 2 */
  tabWidth?: number;
  /** Add ANSI color codes. Default: false */
  color?: boolean;
}>;

/**
 * Format a failure with a small source snippet and caret indicator.
 */
export const formatErrorSnippet = (
  f: Failure,
  opts: FormatErrorSnippetOptions = {},
): string => {
  const contextLines = opts.contextLines ?? 1;
  const tabWidth = opts.tabWidth ?? 2;
  const color = opts.color ?? false;

  const lines = f.ctx.text.split("\n").map((l) =>
    l.endsWith("\r") ? l.slice(0, -1) : l
  );
  const lineIdx = Math.max(0, Math.min(lines.length - 1, f.location.line - 1));

  const startLine = Math.max(0, lineIdx - contextLines);
  const endLine = Math.min(lines.length - 1, lineIdx + contextLines);
  const maxLineNo = endLine + 1;
  const lineNoWidth = String(maxLineNo).length;

  const header =
    `expected ${f.expected} at line ${f.location.line}, column ${f.location.column}`;
  const out: string[] = [
    color ? `${ansi.red}${header}${ansi.reset}` : header,
  ];

  for (let i = startLine; i <= endLine; i++) {
    const rawLine = lines[i] ?? "";
    const printedLine = expandTabs(rawLine, tabWidth);
    const lineNo = String(i + 1).padStart(lineNoWidth, " ");

    out.push(
      color
        ? `${ansi.dim}${lineNo}${ansi.reset} | ${printedLine}`
        : `${lineNo} | ${printedLine}`,
    );

    if (i === lineIdx) {
      // 1-based column -> prefix length in original line (clamped).
      const rawPrefixLen = Math.max(
        0,
        Math.min(rawLine.length, f.location.column - 1),
      );
      const rawPrefix = rawLine.slice(0, rawPrefixLen);
      const caretPos = expandTabs(rawPrefix, tabWidth).length;

      const gutter = " ".repeat(lineNoWidth);
      const caretLine = `${gutter} | ${" ".repeat(caretPos)}^`;
      out.push(color ? `${ansi.yellow}${caretLine}${ansi.reset}` : caretLine);
    }
  }

  return out.join("\n");
};

export type FormatErrorReportOptions = Readonly<{
  /** Include N lines before and after the error line. Default: 1 */
  contextLines?: number;
  /** Expand tabs to this many spaces. Default: 2 */
  tabWidth?: number;
  /** Add ANSI color codes. Default: false */
  color?: boolean;
  /** Include the stack trace section. Default: true */
  stack?: boolean;
}>;

/**
 * A single, non-redundant error message:
 * - one header line (expected + location)
 * - a snippet with a caret
 * - optional context stack frames
 */
export const formatErrorReport = (
  f: Failure,
  opts: FormatErrorReportOptions = {},
): string => {
  const color = opts.color ?? false;
  const header =
    `expected ${f.expected} at line ${f.location.line}, column ${f.location.column}`;

  const out: string[] = [
    color ? `${ansi.red}${header}${ansi.reset}` : header,
    formatErrorSnippet(f, {
      contextLines: opts.contextLines,
      tabWidth: opts.tabWidth,
      color,
    }).split("\n").slice(1).join("\n"), // omit snippet's header line
  ];

  const includeStack = opts.stack ?? true;
  if (includeStack && f.stack.length > 0) {
    for (const frame of f.stack) {
      const line =
        `  ${frame.label} at line ${frame.location.line}, column ${frame.location.column}`;
      out.push(color ? `${ansi.dim}${line}${ansi.reset}` : line);
    }
  }

  return out.join("\n");
};
