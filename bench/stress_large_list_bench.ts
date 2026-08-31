import { bench, group, run } from "mitata";
import { createLexer, eof, map, number, sepBy1, seq } from "../mod.ts";

const N = 5_000;
const text = `[${Array.from({ length: N }, (_, i) => String(i)).join(", ")}]`;

const lx = createLexer();
const num = lx.lexeme(number());
const comma = lx.symbol(",");

const list = map(
  seq(lx.symbol("["), sepBy1(num, comma), lx.symbol("]"), eof()),
  ([, items]) => items,
);

group("stress", () => {
  bench("parse [0..4999] list", () => {
    list({ text, index: 0 });
  });
});

await run({ throw: true });
