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
    name: "@claudiu-ceia/combine",
    version: denoJson.version,
    license: "MIT",
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
    Deno.copyFileSync("README.md", "npm/README.md");
    Deno.copyFileSync("LICENSE", "npm/LICENSE");

    // Keep the npm package lean: declaration maps are nice-to-have but add a
    // surprising amount of weight across ESM+CJS outputs.
    Deno.writeTextFileSync(
      "npm/.npmignore",
      [
        "/src/",
        "**/*.d.ts.map",
        "**/*.js.map",
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
      ].join("\n") + "\n",
    );
  },
});
