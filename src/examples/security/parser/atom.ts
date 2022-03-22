import { str } from "../../../parsers.ts";
import { terminated } from "./combine/combinators.ts";

export const doubleColon = terminated(str(":"));
export const questionMark = terminated(str("?"));
export const semiColon = terminated(str(";"));
export const comma = terminated(str(","));
