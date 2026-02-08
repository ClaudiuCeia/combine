import { build, emptyDir } from "@deno/dnt";

const denoJson = JSON.parse(await Deno.readTextFile("./deno.json")) as {
  name: string;
  version: string;
};

await emptyDir("./npm");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  test: false,
  typeCheck: "both",
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
  },
});
