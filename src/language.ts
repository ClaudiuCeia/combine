// deno-lint-ignore-file no-explicit-any
import type { Parser } from "./Parser.ts";
import { lazy } from "./utility.ts";

const bindLanguage = (
  map: Record<PropertyKey, (self: any) => Parser<any>>,
) => {
  const LanguageDefinition = class LanguageDefinitionClass {
    constructor() {
      for (const key of Reflect.ownKeys(map)) {
        Object.defineProperty(this, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: lazy(() => map[key](this)),
        });
      }
    }
  } as new () => Record<PropertyKey, Parser<any>>;

  return new LanguageDefinition();
};

/**
 * A bound language derived from its production output types.
 */
export type Language<Outputs extends object> = {
  [Key in keyof Outputs]-?: Parser<Outputs[Key]>;
};

/**
 * Parser definitions for an output-schema language.
 */
export type LanguageDefinitions<Outputs extends object> = {
  [Key in keyof Outputs]-?: (
    self: Language<Outputs>,
  ) => Parser<Outputs[Key]>;
};

/**
 * Define a mutually-recursive language from a map of production output types.
 *
 * Each definition receives the complete bound language, so productions can
 * reference each other regardless of declaration order.
 */
export function defineLanguage<const Outputs extends object>(
  map: LanguageDefinitions<Outputs>,
): Language<Outputs> {
  return bindLanguage(map) as Language<Outputs>;
}
