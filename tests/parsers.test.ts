import { assertObjectMatch } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import {
  seq,
  either,
  any,
  optional,
  many,
  many1,
  manyTill,
  sepBy,
  sepBy1,
  skipMany,
  skipMany1,
} from "../src/combinators.ts";
import { anyChar, char, notChar, regex, space, str } from "../src/parsers.ts";
import { map, mapJoin } from "../src/utility.ts";

Deno.test("str", () => {
  assertObjectMatch(
    str("Typescript")({
      text: "Typescript is okay",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "Typescript is okay", index: 10 },
    }
  );

  assertObjectMatch(
    str("Typescript")({
      text: "Haskell is okay",
      index: 0,
    }),
    {
      success: false,
      expected: "Typescript",
      ctx: { text: "Haskell is okay", index: 0 },
    }
  );
});

Deno.test("regex", () => {
  assertObjectMatch(
    regex(
      /[A-Z]+/,
      "expected yelling"
    )({
      text: "typescript is okay",
      index: 0,
    }),
    {
      success: false,
      expected: "expected yelling",
      ctx: { text: "typescript is okay", index: 0 },
    }
  );

  assertObjectMatch(
    regex(
      /[A-Z]+/,
      "expected yelling"
    )({
      text: "TYPESCRIPT is okay",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "TYPESCRIPT is okay", index: 10 },
    }
  );
});

Deno.test("seq", () => {
  const brownAnimal = seq(
    str("brown"),
    str(" "),
    regex(/fox|bear/, "expected fox or bear")
  );

  assertObjectMatch(
    brownAnimal({
      text: "The brown fox jumps over the lazy dog",
      index: 4,
    }),
    {
      success: true,
      ctx: { text: "The brown fox jumps over the lazy dog", index: 13 },
    }
  );

  assertObjectMatch(
    brownAnimal({
      text: "The brown polar bear jumps over the lazy dog",
      index: 4,
    }),
    {
      success: false,
      expected: "expected fox or bear",
      ctx: { text: "The brown polar bear jumps over the lazy dog", index: 10 },
    }
  );
});

Deno.test("either", () => {
  const brownAnimal = seq(
    str("brown"),
    str(" "),
    either(str("fox"), str("bear"))
  );

  assertObjectMatch(
    brownAnimal({
      text: "The brown bear jumps over the lazy dog",
      index: 4,
    }),
    {
      success: true,
      ctx: { text: "The brown bear jumps over the lazy dog", index: 14 },
    }
  );

  assertObjectMatch(
    brownAnimal({
      text: "The brown fox jumps over the lazy dog",
      index: 4,
    }),
    {
      success: true,
      ctx: { text: "The brown fox jumps over the lazy dog", index: 13 },
    }
  );

  assertObjectMatch(
    brownAnimal({
      text: "The brown polar bear jumps over the lazy dog",
      index: 4,
    }),
    {
      success: false,
      expected: "fox",
      ctx: { text: "The brown polar bear jumps over the lazy dog", index: 10 },
    }
  );
});

Deno.test("any", () => {
  const okayLangs = any(str("haskell"), str("typescript"), str("clojure"));

  assertObjectMatch(
    okayLangs({
      text: "haskell is okay",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "haskell is okay", index: 7 },
    }
  );

  assertObjectMatch(
    okayLangs({
      text: "typescript is okay",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "typescript is okay", index: 10 },
    }
  );

  assertObjectMatch(
    okayLangs({
      text: "clojure is okay",
      index: 10,
    }),
    {
      success: false,
      expected: "haskell",
      ctx: { text: "clojure is okay", index: 10 },
    }
  );
});

Deno.test("optional", () => {
  const maybeFluffy = optional(str("fluffy"));

  assertObjectMatch(
    maybeFluffy({
      text: "The fluffy clouds are covering the sky",
      index: 4,
    }),
    {
      success: true,
      ctx: { text: "The fluffy clouds are covering the sky", index: 10 },
    }
  );

  assertObjectMatch(
    maybeFluffy({
      text: "The clouds are covering the sky",
      index: 4,
    }),
    {
      success: true,
      ctx: { text: "The clouds are covering the sky", index: 4 },
    }
  );
});

Deno.test("space", () => {
  assertObjectMatch(
    seq(
      optional(space()),
      str("!")
    )({
      text: "            !",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "            !", index: 13 },
    }
  );

  assertObjectMatch(
    space()({
      text: "          \t",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "          \t", index: 11 },
    }
  );
});

Deno.test("char", () => {
  assertObjectMatch(
    char(34)({
      text: `"`,
      index: 0,
    }),
    {
      success: true,
      ctx: { text: `"`, index: 1 },
    }
  );

  assertObjectMatch(
    char(34)({
      text: `A`,
      index: 0,
    }),
    {
      success: false,
      ctx: { text: `A`, index: 0 },
    }
  );
});

Deno.test("notChar", () => {
  assertObjectMatch(
    notChar(34)({
      text: `"`,
      index: 0,
    }),
    {
      success: false,
      ctx: { text: `"`, index: 0 },
    }
  );

  assertObjectMatch(
    notChar(34)({
      text: `A`,
      index: 0,
    }),
    {
      success: true,
      ctx: { text: `A`, index: 1 },
    }
  );
});

Deno.test("many", () => {
  const manyDigits = many(regex(/\d/, "expected digit"));

  assertObjectMatch(
    manyDigits({
      text: "12345678910",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "12345678910", index: 11 },
    }
  );

  assertObjectMatch(
    manyDigits({
      text: "112111725625AAA",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "112111725625AAA", index: 12 },
    }
  );

  assertObjectMatch(
    manyDigits({
      text: "1AAA",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "1AAA", index: 1 },
    }
  );

  assertObjectMatch(
    manyDigits({
      text: "AAA123",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "AAA123", index: 0 },
    }
  );
});

Deno.test("many1", () => {
  const manyDigits = many1(regex(/\d/, "expected digit"));

  assertObjectMatch(
    manyDigits({
      text: "12345678910",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "12345678910", index: 11 },
    }
  );

  assertObjectMatch(
    manyDigits({
      text: "1AAA",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "1AAA", index: 1 },
    }
  );

  assertObjectMatch(
    manyDigits({
      text: "AAA1",
      index: 0,
    }),
    {
      success: false,
      expected: "Expected at least one match",
      ctx: { text: "AAA1", index: 0 },
    }
  );
});

Deno.test("manyTill", () => {
  const anyLowercaseLetter = regex(/[a-z]/, "expected a lowercase letter");
  const letterOrSpace = either(
    anyLowercaseLetter,
    regex(/\s/, "expected space")
  );

  const commentBlock = seq(str("/*"), manyTill(letterOrSpace, str("*/")));

  assertObjectMatch(
    commentBlock({
      text: "/* the brown fox jumped over the lazy dog */",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "/* the brown fox jumped over the lazy dog */", index: 44 },
    }
  );

  assertObjectMatch(
    commentBlock({
      text: "/* the brown fox jumped over the lazy dog",
      index: 0,
    }),
    {
      success: false,
      expected: "*/",
      ctx: { text: "/* the brown fox jumped over the lazy dog", index: 41 },
    }
  );

  assertObjectMatch(
    commentBlock({
      text: "/**/",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "/**/", index: 4 },
    }
  );
});

Deno.test("sepBy", () => {
  const numberList = sepBy(
    regex(/[0-9]+/, "expected digit or number"),
    str(",")
  );

  assertObjectMatch(
    numberList({
      text: "1,2,3,4,11",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "1,2,3,4,11", index: 10 },
    }
  );

  assertObjectMatch(
    numberList({
      text: "1",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "1", index: 1 },
    }
  );

  assertObjectMatch(
    numberList({
      text: "not a list",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "not a list", index: 0 },
    }
  );
});

Deno.test("sepBy1", () => {
  const numberList = sepBy1(
    regex(/[0-9]+/, "expected digit or number"),
    str(",")
  );

  assertObjectMatch(
    numberList({
      text: "1,2,3,4,11",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "1,2,3,4,11", index: 10 },
    }
  );

  assertObjectMatch(
    numberList({
      text: "1",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "1", index: 1 },
    }
  );

  assertObjectMatch(
    numberList({
      text: "not a list",
      index: 0,
    }),
    {
      success: false,
      expected: "Expected at least one match",
      ctx: { text: "not a list", index: 0 },
    }
  );
});

Deno.test("skipMany", () => {
  const skipNumber = skipMany(regex(/[0-9]+/, "expected digit or number"));

  assertObjectMatch(
    skipNumber({
      text: "123ABC",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "123ABC", index: 3 },
    }
  );

  assertObjectMatch(
    skipNumber({
      text: "ABC123",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "ABC123", index: 0 },
    }
  );
});

Deno.test("skipMany1", () => {
  const skipNumber = skipMany1(regex(/[0-9]+/, "expected digit or number"));

  assertObjectMatch(
    skipNumber({
      text: "123ABC",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "123ABC", index: 3 },
    }
  );

  assertObjectMatch(
    skipNumber({
      text: "ABC123",
      index: 0,
    }),
    {
      success: false,
      expected: "Expected at least a skip",
      ctx: { text: "ABC123", index: 0 },
    }
  );
});

Deno.test("Hello world test", () => {
  const helloWorldParser = seq(
    str("Hello,"),
    optional(space()),
    mapJoin(manyTill(anyChar(), str("!"))),
  );
  
  assertObjectMatch(
    helloWorldParser({
      text: "Hello, World!",
      index: 0,
    }),
    {
      success: true,
      ctx: { text: "Hello, World!", index: 13 },
    }
  );

  const nameParser = map(helloWorldParser, ([,,name]) => name);
  assertObjectMatch(
    nameParser({
      text: "Hello, Joe Doe!",
      index: 0,
    }),
    {
      success: true,
      value: "Joe Doe!",
      ctx: { text: "Hello, Joe Doe!", index: 15 },
    }
  );
});
