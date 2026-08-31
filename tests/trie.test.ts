import { assertEquals, assertObjectMatch } from "./assert.ts";
import { test } from "bun:test";
import { trie } from "../src/parsers.ts";
import { Trie } from "../src/Trie.ts";

test("trie", () => {
  const trie = new Trie();
  trie.insertMany(["Romania", "Germany", "Ronaldo", "Germanic"]);

  assertEquals(trie.exists("Romania"), true);
  assertEquals(trie.exists("Roman"), false);
  assertEquals(trie.exists("Spain"), false);
});

test("trie returns the longest matching prefix", () => {
  const operators = new Trie();
  operators.insertMany(["=", "==", "=>"]);

  assertEquals(operators.existsSubstring("==value"), [true, "=="]);
  assertEquals(operators.existsSubstring("=>value"), [true, "=>"]);
  assertEquals(operators.existsSubstring("=value"), [true, "="]);
  assertEquals(operators.existsSubstring("!value"), [false, undefined]);
});

test("trie matches astral characters with UTF-16 offsets", () => {
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

test("trie parser", () => {
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

test("trie parser fails without consuming when no prefix matches", () => {
  const res = trie(["if", "else"])({ text: "while", index: 0 });
  assertEquals(res.success, false);
  if (!res.success) {
    assertEquals(res.expected, "one of if, else");
    assertEquals(res.ctx.index, 0);
  }
});

test("trie parser uses maximal munch regardless of input order", () => {
  for (const matches of [
    ["=", "==", "=>"],
    ["=>", "==", "="],
  ]) {
    assertObjectMatch(trie(matches)({ text: "==value", index: 0 }), {
      success: true,
      value: "==",
      ctx: { index: 2 },
    });
  }
});
