import { assertEquals, assertObjectMatch } from "@std/assert";
import { trie } from "../src/parsers.ts";
import { Trie } from "../src/Trie.ts";

Deno.test("trie", () => {
  const trie = new Trie();
  trie.insertMany(["Romania", "Germany", "Ronaldo", "Germanic"]);

  assertEquals(trie.exists("Romania"), true);
  assertEquals(trie.exists("Roman"), false);
});

Deno.test("trie parser", () => {
  assertObjectMatch(
    trie(["Romania", "Germany", "Ronaldo", "Germanic"])({
      text: "Ronaldo, not a bad footballer",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "Ronaldo, not a bad footballer", index: 7 },
    },
  );
});
