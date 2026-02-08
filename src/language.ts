// deno-lint-ignore-file no-explicit-any
import type { Parser } from "./Parser.ts";
import { lazy } from "./utility.ts";

// ---------------------------------------------------------------------------
// Legacy types (kept stable)
// ---------------------------------------------------------------------------

export type BoundDefinition<T extends UnboundDefinition<any>> = {
  [Key in keyof T]: ReturnType<T[Key]>;
};

export type UnboundDefinition<T extends BoundDefinition<any>> = {
  [Key in keyof T]: (self: T) => T[Key];
};

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

export type ThisLanguageDefinitions = Record<
  string,
  (this: any) => Parser<any>
>;

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
