// deno-lint-ignore-file no-explicit-any
import type { Parser } from "./Parser.ts";
import { lazy } from "./utility.ts";

// ---------------------------------------------------------------------------
// Legacy types (kept stable)
// ---------------------------------------------------------------------------

/**
 * Convert an "unbound" language definition (map of functions returning parsers)
 * into the corresponding bound language type (map of parsers).
 */
export type BoundDefinition<T extends UnboundDefinition<any>> = {
  [Key in keyof T]: ReturnType<T[Key]>;
};

/**
 * A language definition where each production is a function of `self`.
 *
 * `self` is the bound language (a map of parsers), enabling mutual recursion.
 */
export type UnboundDefinition<T extends BoundDefinition<any>> = {
  [Key in keyof T]: (self: T) => T[Key];
};

/**
 * An untyped language used as the default for `createLanguage`.
 */
export type UntypedLanguage = {
  [key: string]: Parser<unknown>;
};

// ---------------------------------------------------------------------------
// createLanguage
// ---------------------------------------------------------------------------

// Overload 1: legacy API where the type argument is the *bound* language.
export function createLanguage<
  T extends BoundDefinition<any> = UntypedLanguage,
>(
  map: UnboundDefinition<T>,
): BoundDefinition<UnboundDefinition<T>>;

/**
 * Create a mutually-recursive language from a set of parser definitions.
 *
 * Each key in `map` becomes a lazily-evaluated parser on the returned object.
 * This avoids declaration-order issues in mutually-recursive grammars.
 */
export function createLanguage(
  map: Record<string, (self: any) => Parser<any>>,
) {
  const LanguageDefinition = class LanguageDefinitionClass {
    constructor() {
      const bound: Record<string, Parser<any>> = {};
      for (const key of Object.keys(map)) {
        bound[key] = lazy(() => map[key](this));
      }

      Object.assign(this, bound);
    }
  } as new () => Record<string, Parser<any>>;

  return new LanguageDefinition();
}

// ---------------------------------------------------------------------------
// createLanguageThis (inference-friendly)
// ---------------------------------------------------------------------------

/**
 * A language definition where each production is a method using `this`.
 */
export type ThisLanguageDefinitions = Record<
  string,
  (this: any) => Parser<any>
>;

/**
 * The bound language type for `createLanguageThis` (map of parsers).
 */
export type BoundThisLanguage<T extends ThisLanguageDefinitions> = {
  [Key in keyof T]: ReturnType<T[Key]>;
};

type ThisParserFn = (this: any) => Parser<any>;
type EnsureThisParserFns<T extends object> = {
  [Key in keyof T]: T[Key] extends ThisParserFn ? T[Key] : never;
};
type BoundFromThisDefs<T extends object> = {
  [Key in keyof T]: T[Key] extends ThisParserFn ? ReturnType<T[Key]> : never;
};

/**
 * Like `createLanguage`, but uses `this` instead of a `self` parameter.
 *
 * This enables TypeScript to infer the language type from the object literal
 * (via `ThisType<...>`), so callers can usually avoid writing
 * `createLanguage<MyLang>({ ... })`.
 */
export function createLanguageThis<const T extends object>(
  map: EnsureThisParserFns<T> & ThisType<BoundFromThisDefs<T>>,
): BoundFromThisDefs<T> {
  const wrapped: Record<string, (self: any) => Parser<any>> = {};
  const record = map as unknown as Record<string, (this: any) => Parser<any>>;
  for (const key of Object.keys(record)) {
    wrapped[key] = (self) => record[key].call(self);
  }

  return createLanguage(wrapped) as BoundFromThisDefs<T>;
}
