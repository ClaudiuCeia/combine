import type { AdapterFactory } from "../types.ts";
import { createCombineAdapter } from "./combine.ts";
import { createMiniParseAdapter } from "./mini_parse.ts";
import { createParjsAdapter } from "./parjs.ts";
import { createParserCombinatorsAdapter } from "./parser_combinators.ts";
import { createPebermintaAdapter } from "./peberminta.ts";
import { createTarsecAdapter } from "./tarsec.ts";

export const adapterFactories: readonly AdapterFactory[] = [
  { name: "combine", create: createCombineAdapter },
  { name: "parjs", create: createParjsAdapter },
  { name: "peberminta", create: createPebermintaAdapter },
  { name: "mini-parse", create: createMiniParseAdapter },
  {
    name: "parser-combinators",
    create: createParserCombinatorsAdapter,
  },
  { name: "tarsec", create: createTarsecAdapter },
];
