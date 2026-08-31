import { bench, group, run, summary } from "mitata";
import { argv } from "node:process";
import { adapterFactories } from "./comparison/adapters/mod.ts";
import { expressionCases, lateInvalidExpression } from "./comparison/corpus.ts";
import { parseFailure } from "./comparison/types.ts";
import { verifyAdapter } from "./comparison/verify.ts";

const adapters = adapterFactories.map((factory) => factory.create());
for (const adapter of adapters) verifyAdapter(adapter);

let sink: unknown;

for (const testCase of expressionCases) {
  group(`expression/${testCase.name}`, () => {
    summary(() => {
      for (const adapter of adapters) {
        const trial = bench(adapter.name, () => {
          const result = adapter.parseExpression(testCase.input);
          if (result === parseFailure || result !== testCase.expected) {
            throw new Error(
              `${adapter.name} returned the wrong ${testCase.name} result`,
            );
          }
          sink = result;
        });
        if (adapter.name === "combine") trial.baseline();
      }
    });
  });
}

group("expression/invalid-late", () => {
  summary(() => {
    for (const adapter of adapters) {
      const trial = bench(adapter.name, () => {
        const result = adapter.parseExpression(lateInvalidExpression);
        if (result !== parseFailure) {
          throw new Error(`${adapter.name} accepted invalid input`);
        }
        sink = result;
      });
      if (adapter.name === "combine") trial.baseline();
    }
  });
});

group("construct/grammar", () => {
  summary(() => {
    for (const factory of adapterFactories) {
      const trial = bench(factory.name, () => {
        sink = factory.create();
      });
      if (factory.name === "combine") trial.baseline();
    }
  });
});

group("construct/grammar-and-first-parse", () => {
  summary(() => {
    for (const factory of adapterFactories) {
      const trial = bench(factory.name, () => {
        const adapter = factory.create();
        const testCase = expressionCases[0]!;
        const result = adapter.parseExpression(testCase.input);
        if (result === parseFailure || result !== testCase.expected) {
          throw new Error(`${adapter.name} returned the wrong first result`);
        }
        sink = result;
      });
      if (factory.name === "combine") trial.baseline();
    }
  });
});

await run({
  throw: true,
  format: argv.includes("--json")
    ? { json: { debug: false, samples: false } }
    : "mitata",
});

void sink;
