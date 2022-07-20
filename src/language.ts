// deno-lint-ignore-file no-explicit-any
import { Parser } from "./Parser.ts";
import { lazy } from "./utility.ts";

export type BoundDefinition<T extends UnboundDefinition<any>> = {
  [Key in keyof T]: ReturnType<T[Key]>;
};

export type UnboundDefinition<T extends BoundDefinition<any>> = {
  [Key in keyof T]: (self: T) => T[Key];
};

export type UntypedLanguage = Record<string, Parser<any>>;

export const createLanguage = <
  T extends BoundDefinition<any>
>(
  map: UnboundDefinition<T>
) => {
  const LanguageDefinition = class LanguageDefinitionClass {
    constructor() {
      const bound: Partial<BoundDefinition<T>> = {};
      for (const key of Object.keys(map)) {
        bound[key as keyof T] = lazy(() =>
          map[key](this as T)
        ) as unknown as T[keyof T];
      }

      Object.assign(this, bound);
    }
  } as new () => BoundDefinition<typeof map>;

  return new LanguageDefinition();
};