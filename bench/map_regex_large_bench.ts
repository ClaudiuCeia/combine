import { bench, group, run } from "mitata";
import { many, optional, seq, str } from "../mod.ts";
import { regex } from "../src/parsers.ts";
import { map } from "../src/utility.ts";

const num = map(regex(/[0-9]+/, "number"), (s) => parseInt(s, 10));
const maybeDegrees = optional(str(" degrees"));

// Parse: "It's 20 degrees outside.\n" repeated N times.
const clause = seq(
  str("It's "),
  num,
  maybeDegrees,
  str(" outside."),
  optional(str("\n")),
);

const doc = many(clause);

const makeText = (targetLen: number): string => {
  const parts: string[] = [];
  let n = 20;
  while (parts.join("").length < targetLen) {
    parts.push(`It's ${n} degrees outside.\n`);
    n = (n + 1) % 100;
  }
  return parts.join("");
};

const text = makeText(16 * 1024); // > 8k chars

group("large_generated", () => {
  bench("map+regex large generated input", () => {
    doc({ text, index: 0 });
  });
});

await run({ throw: true });
