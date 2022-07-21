import { any, furthest } from "../src/combinators.ts";
import { str, trie } from "../src/parsers.ts";
import UATS from "https://raw.githubusercontent.com/ClaudiuCeia/geojson-romania/master/generated/uats.json" assert { type: "json" };

const trieParser = trie(UATS.map((c) => c.properties.name));
const anyParser = any(...UATS.map((c) => str(c.properties.name)));
const furthestParser = furthest(...UATS.map((c) => str(c.properties.name)));

Deno.bench("any", { group: "trie_vs_any", baseline: true }, () => {
  anyParser({
    text: "Reșița, not great, not terrible.",
    index: 0,
  });
});

Deno.bench("trie", { group: "trie_vs_any" }, () => {
  trieParser({
    text: "Reșița, not great, not terrible.",
    index: 0,
  });
});

Deno.bench("furthest", { group: "trie_vs_any" }, () => {
  furthestParser({
    text: "Reșița, not great, not terrible.",
    index: 0,
  });
});
