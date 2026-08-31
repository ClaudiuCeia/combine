import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface MitataResult {
  layout: Array<{ name: string | null }>;
  benchmarks: Array<{
    alias: string;
    group: number;
    runs: Array<{ stats: { p50: number } }>;
  }>;
}

export interface BenchmarkComparison {
  name: string;
  baseline: number;
  current: number;
  delta: number;
  regression: boolean;
}

export interface BenchmarkReport {
  comparisons: BenchmarkComparison[];
  regressionCount: number;
  markdown: string;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  return sorted[middle]!;
}

function formatDuration(nanoseconds: number): string {
  if (nanoseconds >= 1_000_000)
    return `${(nanoseconds / 1_000_000).toFixed(2)} ms`;
  if (nanoseconds >= 1_000) return `${(nanoseconds / 1_000).toFixed(2)} us`;
  return `${nanoseconds.toFixed(2)} ns`;
}

export function extractCombineMeasurements(
  result: MitataResult,
): Map<string, number> {
  const measurements = new Map<string, number>();

  for (const benchmark of result.benchmarks) {
    if (benchmark.alias !== "combine") continue;

    const group = result.layout[benchmark.group]?.name;
    const p50 = benchmark.runs[0]?.stats.p50;
    if (!group || p50 === undefined || !Number.isFinite(p50) || p50 <= 0) {
      throw new Error("Invalid combine benchmark result");
    }
    if (measurements.has(group))
      throw new Error(`Duplicate benchmark: ${group}`);
    measurements.set(group, p50);
  }

  if (measurements.size === 0) throw new Error("No combine benchmarks found");
  return measurements;
}

export function compareBenchmarkRuns(
  baselineRuns: Array<Map<string, number>>,
  currentRuns: Array<Map<string, number>>,
  thresholdPercent: number,
): BenchmarkReport {
  if (baselineRuns.length === 0 || currentRuns.length === 0) {
    throw new Error(
      "At least one baseline and current benchmark run is required",
    );
  }
  if (!Number.isFinite(thresholdPercent) || thresholdPercent <= 0) {
    throw new Error("The regression threshold must be positive");
  }

  const names = [...baselineRuns[0]!.keys()].sort();
  const expected = names.join("\n");
  for (const run of [...baselineRuns, ...currentRuns]) {
    if ([...run.keys()].sort().join("\n") !== expected) {
      throw new Error("Baseline and current benchmark sets do not match");
    }
  }

  const comparisons = names.map((name): BenchmarkComparison => {
    const baseline = median(baselineRuns.map((run) => run.get(name)!));
    const current = median(currentRuns.map((run) => run.get(name)!));
    const delta = ((current - baseline) / baseline) * 100;
    return {
      name,
      baseline,
      current,
      delta,
      regression: delta > thresholdPercent,
    };
  });
  const regressionCount = comparisons.filter(
    ({ regression }) => regression,
  ).length;
  const status =
    regressionCount === 0
      ? `Passed: no benchmark exceeded the ${thresholdPercent}% regression threshold.`
      : `Failed: ${regressionCount} benchmark${regressionCount === 1 ? "" : "s"} exceeded the ${thresholdPercent}% regression threshold.`;
  const rows = comparisons.map(
    ({ name, baseline, current, delta, regression }) =>
      `| \`${name}\` | ${formatDuration(baseline)} | ${formatDuration(current)} | ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% | ${regression ? "Fail" : "Pass"} |`,
  );
  const markdown = [
    "## Performance",
    "",
    status,
    "",
    `Results use the median p50 from ${baselineRuns.length} base and ${currentRuns.length} head runs on the same runner.`,
    "",
    "| Benchmark | Base | Head | Change | Result |",
    "| --- | ---: | ---: | ---: | :---: |",
    ...rows,
    "",
  ].join("\n");

  return { comparisons, regressionCount, markdown };
}

async function readRuns(
  directory: string,
): Promise<Array<Map<string, number>>> {
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  if (files.length === 0)
    throw new Error(`No benchmark results found in ${directory}`);

  return Promise.all(
    files.map(async (file) => {
      const result = JSON.parse(
        await readFile(join(directory, file), "utf8"),
      ) as MitataResult;
      return extractCombineMeasurements(result);
    }),
  );
}

function readOption(name: string): string {
  const index = process.argv.indexOf(name);
  const value = process.argv[index + 1];
  if (index === -1 || !value) throw new Error(`Missing ${name}`);
  return value;
}

async function main(): Promise<void> {
  const baselineDirectory = readOption("--baseline");
  const currentDirectory = readOption("--current");
  const output = readOption("--output");
  const threshold = Number(readOption("--threshold"));
  const report = compareBenchmarkRuns(
    await readRuns(baselineDirectory),
    await readRuns(currentDirectory),
    threshold,
  );

  await writeFile(output, report.markdown);
  process.stdout.write(report.markdown);
  if (report.regressionCount > 0) process.exitCode = 1;
}

if (import.meta.main) await main();
