export type Parser<T> = (ctx: Context) => Result<T>;

export type Context = Readonly<{
  text: string;
  index: number;
}>;

export type Result<T> = Success<T> | Failure;

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
