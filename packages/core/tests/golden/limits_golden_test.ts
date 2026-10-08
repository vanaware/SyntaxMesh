import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { Limits, } from "../../src/scheduling/limits.ts";
import { ScoreboardInterval, } from "../../src/time/scoreboard-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { MockProject, } from "../model/mock-project.ts";

/**
 * Golden test runner for Limits compatibility cases.
 *
 * Reads cases from `limits.golden.json` and executes each case against the
 * current Limits implementation, comparing the actual output to the
 * expected value recorded in the golden file.
 */

interface GoldenCase {
  description: string;
  method: string;
  input: {
    name: string;
    index: number | null;
    upper: boolean;
  };
  expected: unknown;
}

interface GoldenFile {
  version: string;
  description: string;
  generated_at: string;
  cases: GoldenCase[];
}

function loadGoldenFile(): GoldenFile {
  // Read the golden file relative to this test file's directory
  const path = new URL("./limits.golden.json", import.meta.url,);
  const content = Deno.readTextFileSync(path,);
  return JSON.parse(content,) as GoldenFile;
}

function runCase(c: GoldenCase,): void {
  const project = new MockProject(1,);
  const sbStart = TjTime.fromDate(new Date("2026-01-01T00:00:00Z",),);
  const sbEnd = TjTime.fromDate(new Date("2026-01-08T00:00:00Z",),);
  const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);

  const limits = new Limits();
  limits.setProject(project,);

  // Setup project attributes as in the Ruby script
  project.set("start", TjTime.fromDate(new Date("2026-01-01T00:00:00Z",),),);
  project.set("end", TjTime.fromDate(new Date("2026-01-08T00:00:00Z",),),);
  project.set("scheduleGranularity", 3600,);

  // Execute the test based on method
  switch (c.method) {
    case "ok?": {
      const index = c.input.index;
      const upper = c.input.upper;

      // Replay the setup operations from the Ruby script based on the test case
      // Each test case corresponds to a specific setup in the Ruby script
      if (
        c.input.name === "dailymax" && c.description.includes("after 3 inc",)
      ) {
        // Setup dailymax: value=3, increment 3 times at idx 0
        limits.setLimit("dailymax", 3, interval,);
        const limit = limits.limits[0]!;
        limits.inc(0,);
        limits.inc(0,);
        limits.inc(0,);
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else if (
        c.input.name === "dailymax" && c.description.includes("after dec",)
      ) {
        // Setup dailymax: value=3, inc 3 times, dec once
        limits.setLimit("dailymax", 3, interval,);
        const limit = limits.limits[0]!;
        limits.inc(0,);
        limits.inc(0,);
        limits.inc(0,);
        limits.dec(0,);
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else if (
        c.input.name === "dailymin" && c.description.includes("no inc",)
      ) {
        // Setup dailymin: value=2, no inc
        limits.setLimit("dailymin", 2, interval,);
        const limit = limits.limits[0]!;
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else if (
        c.input.name === "dailymin" && c.description.includes("after 2 inc",)
      ) {
        // Setup dailymin: value=2, inc twice
        limits.setLimit("dailymin", 2, interval,);
        const limit = limits.limits[0]!;
        limits.inc(0,);
        limits.inc(0,);
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else if (
        c.input.name === "weeklymax" && c.description.includes("after 3 inc",)
      ) {
        // Setup weeklymax: value=2, inc 3 times at idx 0
        limits.setLimit("weeklymax", 2, interval,);
        const limit = limits.limits[0]!;
        limits.inc(0,);
        limits.inc(0,);
        limits.inc(0,);
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else if (
        c.input.name === "weeklymax" && c.description.includes("ok?(24,true)",)
      ) {
        // Setup weeklymax: value=2, inc 3 times at idx 0, check index 24
        limits.setLimit("weeklymax", 2, interval,);
        const limit = limits.limits[0]!;
        limits.inc(0,);
        limits.inc(0,);
        limits.inc(0,);
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else if (
        c.input.name === "weeklymin" && c.description.includes("no inc",)
      ) {
        // Setup weeklymin: value=2, no inc
        limits.setLimit("weeklymin", 2, interval,);
        const limit = limits.limits[0]!;
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else if (
        c.input.name === "monthlymax" && c.description.includes("after 3 inc",)
      ) {
        // Setup monthlymax: value=2, inc 3 times at idx 0
        limits.setLimit("monthlymax", 2, interval,);
        const limit = limits.limits[0]!;
        limits.inc(0,);
        limits.inc(0,);
        limits.inc(0,);
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else if (
        c.input.name === "monthlymin" && c.description.includes("no inc",)
      ) {
        // Setup monthlymin: value=2, no inc
        limits.setLimit("monthlymin", 2, interval,);
        const limit = limits.limits[0]!;
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else if (
        c.input.name === "maximum" && c.description.includes("after 2 inc",)
      ) {
        // Setup maximum: value=3600 (1h), inc 2 times at idx 0
        limits.setLimit("maximum", 3600, interval,);
        const limit = limits.limits[0]!;
        limits.inc(0,);
        limits.inc(0,);
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else if (
        c.input.name === "maximum" && c.description.includes("after 3 inc",)
      ) {
        // Setup maximum: value=3600 (1h), inc 3 times at idx 0
        limits.setLimit("maximum", 3600, interval,);
        const limit = limits.limits[0]!;
        limits.inc(0,);
        limits.inc(0,);
        limits.inc(0,);
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else if (
        c.input.name === "minimum" && c.description.includes("no inc",)
      ) {
        // Setup minimum: value=3600, no inc
        limits.setLimit("minimum", 3600, interval,);
        const limit = limits.limits[0]!;
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else if (
        c.input.name === "minimum" && c.description.includes("after 1 inc",)
      ) {
        // Setup minimum: value=3600, inc once
        limits.setLimit("minimum", 3600, interval,);
        const limit = limits.limits[0]!;
        limits.inc(0,);
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else if (
        c.input.name === "dailymax" &&
        c.description.includes("after 1 inc ok?(null,true)",)
      ) {
        // Setup dailymax: value=1, inc
        limits.setLimit("dailymax", 1, interval,);
        const limit = limits.limits[0]!;
        limits.inc(0,);
        const actual = limit.ok(null, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else if (
        c.input.name === "dailymax" && c.description.includes("after reset",)
      ) {
        // Setup dailymax: value=1, inc then reset
        limits.setLimit("dailymax", 1, interval,);
        const limit = limits.limits[0]!;
        limits.inc(0,);
        limit.reset(0,);
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      } else {
        // Default setup for other cases
        limits.setLimit(c.input.name, 3, interval,);
        const limit = limits.limits[0]!;
        const actual = limit.ok(index, upper, null,);
        assertEquals(
          actual,
          c.expected,
          `Golden case "${c.description}" failed for method ${c.method}`,
        );
      }
      break;
    }
    default:
      throw new Error(`Unknown method in golden file: ${c.method}`,);
  }
}

describe("Limits golden tests", () => {
  const golden = loadGoldenFile();

  for (const c of golden.cases) {
    it(`${c.method}: ${c.description}`, () => {
      runCase(c,);
    });
  }
});
