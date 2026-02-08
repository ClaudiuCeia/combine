import { createLexer, eof, map, number, sepBy1, seq } from "../mod.ts";

const N = 5_000;
const text = `[${Array.from({ length: N }, (_, i) => String(i)).join(", ")}]`;

const lx = createLexer();
const num = lx.lexeme(number());
const comma = lx.symbol(",");

const list = map(
  seq(lx.symbol("["), sepBy1(num, comma), lx.symbol("]"), eof()),
  ([, items]) => items.filter((v): v is number => typeof v === "number"),
);

Deno.bench("parse [0..4999] list", { group: "stress" }, () => {
  list({ text, index: 0 });
});
