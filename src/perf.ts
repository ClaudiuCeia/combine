import type { Parser, Result } from "./Parser.ts";

/**
 * Aggregated stats for a single wrapped parser.
 */
export type TraceRow = Readonly<{
  name: string;
  calls: number;
  success: number;
  failure: number;
  fatalFailure: number;
  consumed: number;
  timeMs: number;
  maxTimeMs: number;
}>;

/**
 * A lightweight tracer that can wrap parsers and report aggregated stats.
 */
export type Tracer = Readonly<{
  /**
   * Wrap a parser and attribute its runtime/behavior to `name`.
   */
  wrap: <T>(name: string, p: Parser<T>) => Parser<T>;
  /**
   * Get current rows (sorted by descending total time).
   */
  rows: () => TraceRow[];
  /**
   * Clear all accumulated stats.
   */
  reset: () => void;
}>;

const nowDefault = (): number => {
  const perf = (globalThis as { performance?: { now?: () => number } })
    .performance;
  return typeof perf?.now === "function" ? perf.now() : Date.now();
};

type MutableRow = {
  name: string;
  calls: number;
  success: number;
  failure: number;
  fatalFailure: number;
  consumed: number;
  timeMs: number;
  maxTimeMs: number;
};

const getOrCreateRow = (
  m: Map<string, MutableRow>,
  name: string,
): MutableRow => {
  const existing = m.get(name);
  if (existing) return existing;
  const created: MutableRow = {
    name,
    calls: 0,
    success: 0,
    failure: 0,
    fatalFailure: 0,
    consumed: 0,
    timeMs: 0,
    maxTimeMs: 0,
  };
  m.set(name, created);
  return created;
};

/**
 * Create a tracer for profiling parsers.
 *
 * Pass `now` for deterministic tests.
 */
export const createTracer = (opts?: { now?: () => number }): Tracer => {
  const now = opts?.now ?? nowDefault;
  const m = new Map<string, MutableRow>();

  return {
    wrap: <T>(name: string, p: Parser<T>): Parser<T> => {
      return (ctx) => {
        const row = getOrCreateRow(m, name);
        row.calls++;

        const t0 = now();
        const res = p(ctx) as Result<T>;
        const dt = now() - t0;

        row.timeMs += dt;
        if (dt > row.maxTimeMs) row.maxTimeMs = dt;

        if (res.success) {
          row.success++;
          const consumed = res.ctx.index - ctx.index;
          if (consumed > 0) row.consumed += consumed;
        } else {
          row.failure++;
          if (res.fatal) row.fatalFailure++;
        }

        return res;
      };
    },
    rows: (): TraceRow[] => {
      return [...m.values()]
        .map((r) => ({ ...r }))
        .sort((a, b) => b.timeMs - a.timeMs);
    },
    reset: (): void => {
      m.clear();
    },
  };
};

/**
 * Render trace rows as a simple fixed-width table for logs/terminals.
 */
export const formatTraceTable = (rows: TraceRow[]): string => {
  const headers = [
    "name",
    "calls",
    "ok",
    "fail",
    "fatal",
    "consumed",
    "timeMs",
    "maxMs",
  ] as const;

  const cells: string[][] = [
    [...headers],
    ...rows.map((r) => [
      r.name,
      String(r.calls),
      String(r.success),
      String(r.failure),
      String(r.fatalFailure),
      String(r.consumed),
      r.timeMs.toFixed(3),
      r.maxTimeMs.toFixed(3),
    ]),
  ];

  const widths = headers.map((_, i) =>
    Math.max(...cells.map((row) => row[i]!.length))
  );

  const pad = (s: string, w: number) => s.padEnd(w, " ");
  const lines: string[] = [];
  lines.push(cells[0]!.map((c, i) => pad(c, widths[i]!)).join("  "));
  lines.push(widths.map((w) => "-".repeat(w)).join("  "));
  for (let i = 1; i < cells.length; i++) {
    lines.push(cells[i]!.map((c, j) => pad(c, widths[j]!)).join("  "));
  }

  return lines.join("\n");
};
