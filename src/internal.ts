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

export const preserveContextFinality = (
  session: Context,
  returned: Context,
): Context => {
  if (session.final === returned.final) return returned;

  return session.final === undefined
    ? { text: returned.text, index: returned.index }
    : { text: returned.text, index: returned.index, final: session.final };
};
