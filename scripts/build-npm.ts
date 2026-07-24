import { build, emptyDir } from "@deno/dnt";

const denoJson = JSON.parse(await Deno.readTextFile("./deno.json")) as {
  name: string;
  version: string;
};

await emptyDir("./npm");

await build({
  entryPoints: [
    "./mod.ts",
    { name: "./nondeterministic", path: "./src/nondeterministic.ts" },
    { name: "./perf", path: "./src/perf.ts" },
  ],
  outDir: "./npm",
  test: false,
  // ESM-only npm output.
  esModule: true,
  scriptModule: false,
  typeCheck: "single",
  compilerOptions: {
    sourceMap: false,
    inlineSources: false,
  },
  shims: {
    // This library is runtime-agnostic; avoid injecting Deno polyfills.
    deno: false,
    weakRef: false,
    webSocket: false,
    blob: false,
    crypto: false,
    domException: false,
    fetch: false,
    file: false,
    fileReader: false,
    formData: false,
    headers: false,
    httpClient: false,
    readFile: false,
    timers: false,
    url: false,
    urlSearchParams: false,
  },
  package: {
    name: denoJson.name,
    version: denoJson.version,
    description: "Typed parser combinators for TypeScript",
    keywords: [
      "parser",
      "parser-combinators",
      "typescript",
      "deno",
    ],
    license: "MIT",
    homepage: "https://github.com/ClaudiuCeia/combine#readme",
    sideEffects: false,
    engines: {
      node: ">=20",
    },
    types: "./esm/mod.d.ts",
    repository: {
      type: "git",
      url: "git+https://github.com/ClaudiuCeia/combine.git",
    },
    bugs: {
      url: "https://github.com/ClaudiuCeia/combine/issues",
    },
  },
  // Keep the published surface predictable (no test files, no bench).
  filterDiagnostic(diagnostic) {
    // Fail on all TypeScript diagnostics.
    return diagnostic;
  },
  postBuild() {
    const packagePath = "npm/package.json";
    const npmPackage = JSON.parse(Deno.readTextFileSync(packagePath)) as {
      exports: Record<string, { import: string; types?: string }>;
    };
    for (const [name, entry] of Object.entries(npmPackage.exports)) {
      npmPackage.exports[name] = {
        types: entry.import.replace(/\.js$/, ".d.ts"),
        ...entry,
      };
    }
    Deno.writeTextFileSync(
      packagePath,
      `${JSON.stringify(npmPackage, null, 2)}\n`,
    );

    Deno.copyFileSync("README.md", "npm/README.md");
    Deno.copyFileSync("LICENSE", "npm/LICENSE");

    Deno.writeTextFileSync(
      "npm/.npmignore",
      [
        "/src/",
        "**/*.js.map",
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
      ].join("\n") + "\n",
    );
  },
});
