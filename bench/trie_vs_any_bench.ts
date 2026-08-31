import { bench, group, run, summary } from "mitata";
import { any, furthest, str, trie } from "../mod.ts";

// Synthetic, deterministic dataset (no network). Keep this small enough that
// `any(...parsers)` doesn't hit argument limits.
const WORDS = 2048;
const words: string[] = [];
for (let i = 0; i < WORDS; i++) {
  // Common prefix makes `trie(...)` a good fit and reflects real-world token sets.
  words.push(`keyword_${String(i).padStart(4, "0")}_suffix`);
}

const trieParser = trie(words);
const anyParser = any(...words.map((w) => str(w)));
const furthestParser = furthest(...words.map((w) => str(w)));

const target = words[Math.floor(WORDS * 0.75)]!;
const text = `${target}, not great, not terrible.`;

group("trie_vs_any", () => {
  summary(() => {
    bench("any", () => {
      anyParser({ text, index: 0 });
    });

    bench("trie", () => {
      trieParser({ text, index: 0 });
    }).baseline();

    bench("furthest", () => {
      furthestParser({ text, index: 0 });
    });
  });
});

await run({ throw: true });
