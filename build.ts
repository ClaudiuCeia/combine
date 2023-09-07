import { build, emptyDir } from "https://deno.land/x/dnt@0.38.1/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  shims: {
    deno: true,
  },
  package: {
    name: "deno-combine",
    version: Deno.args[0],
    description:
      "An implementation of parser combinators for Deno (ported to NPM).",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/ClaudiuCeia/combine.git",
    },
    bugs: {
      url: "https://github.com/ClaudiuCeia/combine/issues",
    },
  },
});

// post build steps
Deno.copyFileSync("LICENSE", "npm/LICENSE");
Deno.copyFileSync("README.md", "npm/README.md");
