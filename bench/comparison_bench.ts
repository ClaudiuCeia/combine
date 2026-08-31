import { adapterFactories } from "./comparison/adapters/mod.ts";
import { expressionCases, lateInvalidExpression } from "./comparison/corpus.ts";
import { parseFailure } from "./comparison/types.ts";
import { verifyAdapter } from "./comparison/verify.ts";

const adapters = adapterFactories.map((factory) => factory.create());
for (const adapter of adapters) verifyAdapter(adapter);

let sink: unknown;

for (const testCase of expressionCases) {
  for (const adapter of adapters) {
    Deno.bench({
      name: adapter.name,
      group: `expression/${testCase.name}`,
      baseline: adapter.name === "combine",
      fn: () => {
        const result = adapter.parseExpression(testCase.input);
        if (result === parseFailure || result !== testCase.expected) {
          throw new Error(
            `${adapter.name} returned the wrong ${testCase.name} result`,
          );
        }
        sink = result;
      },
    });
  }
}

for (const adapter of adapters) {
  Deno.bench({
    name: adapter.name,
    group: "expression/invalid-late",
    baseline: adapter.name === "combine",
    fn: () => {
      const result = adapter.parseExpression(lateInvalidExpression);
      if (result !== parseFailure) {
        throw new Error(`${adapter.name} accepted invalid input`);
      }
      sink = result;
    },
  });
}

for (const factory of adapterFactories) {
  Deno.bench({
    name: factory.name,
    group: "construct/grammar",
    baseline: factory.name === "combine",
    fn: () => {
      sink = factory.create();
    },
  });

  Deno.bench({
    name: factory.name,
    group: "construct/grammar-and-first-parse",
    baseline: factory.name === "combine",
    fn: () => {
      const adapter = factory.create();
      const testCase = expressionCases[0]!;
      const result = adapter.parseExpression(testCase.input);
      if (result === parseFailure || result !== testCase.expected) {
        throw new Error(`${adapter.name} returned the wrong first result`);
      }
      sink = result;
    },
  });
}

void sink;
