import type { Context } from "./Parser.ts";

export const preserveContextFinality = (
  session: Context,
  returned: Context,
): Context => {
  if (session.final === returned.final) return returned;

  return session.final === undefined
    ? { text: returned.text, index: returned.index }
    : { text: returned.text, index: returned.index, final: session.final };
};
