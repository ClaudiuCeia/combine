import { adapterFactories } from "./comparison/adapters/mod.ts";
import { verifyAdapter } from "./comparison/verify.ts";

for (const factory of adapterFactories) {
  verifyAdapter(factory.create());
  console.log(`verified ${factory.name}`);
}
