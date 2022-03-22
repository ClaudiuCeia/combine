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

export type Failure = Readonly<{
  success: false;
  expected: string;
  ctx: Context;
  location: {
    column: number;
    line: number;
  };
  variants: Failure[];
}>;

export const success = <T>(ctx: Context, value: T): Success<T> => {
  return {
    success: true,
    value,
    ctx,
  };
};

export const failure = (
  ctx: Context,
  expected: string,
  variants: Failure[] = []
): Failure => {
  const parsedCtx = ctx.text.slice(0, ctx.index);
  const parsedLines = parsedCtx.split("\n");
  const line = parsedLines.length;
  const column = parsedLines.pop()?.length;

  return {
    success: false,
    expected,
    ctx,
    location: {
      line,
      column: (column && column + 1) || NaN,
    },
    variants,
  };
};
