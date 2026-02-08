import { assertEquals } from "@std/assert";
import { createTracer, formatTraceTable } from "../src/perf.ts";
import { failure, type Parser, success } from "../src/Parser.ts";

Deno.test("tracer counts calls and consumed input", () => {
  let t = 0;
  const tracer = createTracer({ now: () => ++t }); // deterministic

  const ok1: Parser<string> = (ctx) =>
    success({ ...ctx, index: ctx.index + 2 }, "ok");
  const bad: Parser<string> = (ctx) => failure(ctx, "nope");

  const p = tracer.wrap("ok1", ok1);
  const q = tracer.wrap("bad", bad);

  const r1 = p({ text: "abcd", index: 0 });
  assertEquals(r1.success, true);
  const r2 = q({ text: "abcd", index: 2 });
  assertEquals(r2.success, false);

  const rows = tracer.rows();
  assertEquals(rows.length, 2);

  const okRow = rows.find((x) => x.name === "ok1")!;
  assertEquals(okRow.calls, 1);
  assertEquals(okRow.success, 1);
  assertEquals(okRow.failure, 0);
  assertEquals(okRow.consumed, 2);

  const badRow = rows.find((x) => x.name === "bad")!;
  assertEquals(badRow.calls, 1);
  assertEquals(badRow.success, 0);
  assertEquals(badRow.failure, 1);
});

Deno.test("formatTraceTable prints a header and rows", () => {
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
