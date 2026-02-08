import {
  createTracer,
  formatTraceTable,
  many,
  optional,
  seq,
  str,
} from "../mod.ts";
import { regex } from "../src/parsers.ts";
import { map } from "../src/utility.ts";

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

const tracer = createTracer();
const num = tracer.wrap(
  "regex:number",
  map(regex(/[0-9]+/, "number"), (s) => parseInt(s, 10)),
);

const clause = seq(
  tracer.wrap("str:It's ", str("It's ")),
  num,
  tracer.wrap("opt: degrees", optional(str(" degrees"))),
  tracer.wrap("str: outside.", str(" outside.")),
  tracer.wrap("opt:\\n", optional(str("\n"))),
);

const doc = tracer.wrap("many(clause)", many(clause));

const res = doc({ text, index: 0 });
if (!res.success) {
  console.error(res);
  Deno.exit(1);
}

console.log(formatTraceTable(tracer.rows()));
