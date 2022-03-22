import { str } from "../../../parsers.ts";
import { terminated } from "./combine/combinators.ts";

export const ifKeyword = terminated(str("if"));
export const elseKeyword = terminated(str("else"));
export const letKeyword = terminated(str("let"));
export const allowKeyword = terminated(str("allow"));
export const denyKeyword = terminated(str("deny"));
export const skipKeyword = terminated(str("skip"));
export const returnKeyword = terminated(str("return"));
export const forKeyword = terminated(str("for"));
export const breakKeyword = terminated(str("break"));
export const continueKeyword = terminated(str("continue"));
export const fnKeyword = terminated(str("function"));
