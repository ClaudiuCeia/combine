import { assertEquals, assertObjectMatch } from "@std/assert";
import { trie } from "../src/parsers.ts";
import { Trie } from "../src/Trie.ts";

Deno.test("trie", () => {
  const trie = new Trie();
  trie.insertMany(["Romania", "Germany", "Ronaldo", "Germanic"]);

  assertEquals(trie.exists("Romania"), true);
  assertEquals(trie.exists("Roman"), false);
});

Deno.test("trie returns the longest matching prefix", () => {
  const operators = new Trie();
  operators.insertMany(["=", "==", "=>"]);

  assertEquals(operators.existsSubstring("==value"), [true, "=="]);
  assertEquals(operators.existsSubstring("=>value"), [true, "=>"]);
  assertEquals(operators.existsSubstring("=value"), [true, "="]);
  assertEquals(operators.existsSubstring("!value"), [false, undefined]);
});

Deno.test("trie matches astral characters with UTF-16 offsets", () => {
  const words = new Trie();
  words.insertMany(["😀", "😀ok", "🚀"]);

  assertEquals(words.exists("😀"), true);
  assertEquals(words.exists("🚀"), true);
  assertEquals(words.existsSubstring("😀okay"), [true, "😀ok"]);
  assertObjectMatch(trie(["😀", "😀ok"])({ text: "😀okay", index: 0 }), {
    success: true,
    value: "😀ok",
    ctx: { index: 4 },
  });
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

Deno.test("trie parser uses maximal munch regardless of input order", () => {
  for (const matches of [["=", "==", "=>"], ["=>", "==", "="]]) {
    assertObjectMatch(trie(matches)({ text: "==value", index: 0 }), {
      success: true,
      value: "==",
      ctx: { index: 2 },
    });
  }
});
