#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/combine-npm-consumer.XXXXXX")"
trap 'rm -rf "${temp_dir}"' EXIT

tarball_name="$(npm pack "${repo_root}/npm" --pack-destination "${temp_dir}" --silent)"
consumer_dir="${temp_dir}/consumer"
mkdir "${consumer_dir}"

cat > "${consumer_dir}/package.json" <<'JSON'
{
  "private": true,
  "type": "module"
}
JSON

npm install \
  --prefix "${consumer_dir}" \
  --ignore-scripts \
  --no-audit \
  --no-fund \
  "${temp_dir}/${tarball_name}" \
  "typescript@~5.9.0"

cat > "${consumer_dir}/consumer.ts" <<'TS'
import { parseAll, type Result, str } from "@claudiu-ceia/combine";
import { recognizeAt } from "@claudiu-ceia/combine/nondeterministic";
import { createTracer } from "@claudiu-ceia/combine/perf";

const result: Result<string> = parseAll(str("value"), "value");
if (!result.success || result.value !== "value") throw new Error("parse failed");

recognizeAt(str("value"));
createTracer();
TS

cat > "${consumer_dir}/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "noEmit": true,
    "strict": true,
    "target": "ES2022"
  },
  "include": ["consumer.ts"]
}
JSON

"${consumer_dir}/node_modules/.bin/tsc" --project "${consumer_dir}/tsconfig.json"

(
cd "${consumer_dir}"
node --input-type=module - <<'JS'
import { parseAll, str } from "@claudiu-ceia/combine";

const result = parseAll(str("value"), "value");
if (!result.success || result.value !== "value") process.exit(1);
JS
)
