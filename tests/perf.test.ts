import { assertEquals } from "./assert.ts";
import { test } from "bun:test";
import { createTracer, formatTraceTable } from "../src/perf.ts";
import { failure, fatalFailure, type Parser, success } from "../src/Parser.ts";

test("tracer counts calls and consumed input", () => {
  let t = 0;
  const tracer = createTracer({ now: () => ++t }); // deterministic

  const ok1: Parser<string> = (ctx) =>
    success({ ...ctx, index: ctx.index + 2 }, "ok");
  const bad: Parser<string> = (ctx) => failure(ctx, "nope");

  const p = tracer.wrap("ok1", ok1);
  const q = tracer.wrap("bad", bad);

  const r1 = p({ text: "abcd", index: 0 });
  assertEquals(r1.success, true);
  const r1Again = p({ text: "abcd", index: 0 });
  assertEquals(r1Again.success, true);
  const r2 = q({ text: "abcd", index: 2 });
  assertEquals(r2.success, false);

  const rows = tracer.rows();
  assertEquals(rows.length, 2);

  const okRow = rows.find((x) => x.name === "ok1")!;
  assertEquals(okRow.calls, 2);
  assertEquals(okRow.success, 2);
  assertEquals(okRow.failure, 0);
  assertEquals(okRow.consumed, 4);

  const badRow = rows.find((x) => x.name === "bad")!;
  assertEquals(badRow.calls, 1);
  assertEquals(badRow.success, 0);
  assertEquals(badRow.failure, 1);
});

test("tracer uses the default clock", () => {
  const tracer = createTracer();
  tracer.wrap("ok", (ctx) => success(ctx, null))({ text: "", index: 0 });

  const [row] = tracer.rows();
  assertEquals(Number.isFinite(row.timeMs), true);
  assertEquals(Number.isFinite(row.maxTimeMs), true);
  assertEquals(row.timeMs >= 0, true);
  assertEquals(row.maxTimeMs >= 0, true);
});

test("tracer counts fatal failures and can reset its rows", () => {
  const tracer = createTracer({ now: () => 0 });
  const parser = tracer.wrap("fatal", (ctx) => fatalFailure(ctx, "fatal"));

  const res = parser({ text: "", index: 0 });
  assertEquals(res.success, false);
  assertEquals(tracer.rows()[0].fatalFailure, 1);

  tracer.reset();
  assertEquals(tracer.rows(), []);
});

test("formatTraceTable prints a header and rows", () => {
  const table = formatTraceTable([
    {
      name: "p",
      calls: 2,
      success: 1,
      failure: 1,
      fatalFailure: 0,
      consumed: 3,
      timeMs: 1.23456,
      maxTimeMs: 1.0,
    },
  ]);

  assertEquals(table.includes("name"), true);
  assertEquals(table.includes("calls"), true);
  assertEquals(table.includes("p"), true);
  assertEquals(table.includes("1.235"), true);
});
