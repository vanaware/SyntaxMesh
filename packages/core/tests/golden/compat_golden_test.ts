import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { TjTime, } from "../../src/time/tj-time.ts";
import { compat, } from "../../src/compat.ts";

/**
 * Compatibility golden test runner.
 *
 * Validates that the TjTime implementation behaves correctly in both
 * compatibility mode (keepRubyBugs=true) and fixed mode (keepRubyBugs=false).
 *
 * - tjtime.golden.json: validates behavior with keepRubyBugs=true (default)
 * - compat-fix.golden.json: validates behavior with keepRubyBugs=false
 */

interface GoldenCase {
  description: string;
  method: string;
  input: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
  expected: unknown;
  timezone?: string;
  format?: string;
  end?: { year: number; month: number; day: number; hour: number; minute: number; second: number };
  step?: number;
  compareWith?: { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

interface GoldenFile {
  version: string;
  description: string;
  generated_at: string;
  cases: GoldenCase[];
}

function loadGoldenFile(path: string): GoldenFile {
  const url = new URL(path, import.meta.url,);
  const content = Deno.readTextFileSync(url,);
  return JSON.parse(content,) as GoldenFile;
}

function partsOf(t: TjTime,): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = t.to_a();
  return {
    year: parts[0]!,
    month: parts[1]!,
    day: parts[2]!,
    hour: parts[3]!,
    minute: parts[4]!,
    second: parts[5]!,
  };
}

function runCase(c: GoldenCase, keepRubyBugs: boolean,): void {
  const originalKeepRubyBugs = compat.keepRubyBugs;
  compat.keepRubyBugs = keepRubyBugs;

  try {
    const t = TjTime.fromParts(
      c.input.year,
      c.input.month,
      c.input.day,
      c.input.hour,
      c.input.minute,
      c.input.second,
    );

    let actual: unknown;
    switch (c.method) {
      case "sameTimeNextDay":
        actual = partsOf(t.sameTimeNextDay(),);
        break;
      case "sameTimeNextWeek":
        actual = partsOf(t.sameTimeNextWeek(),);
        break;
      case "sameTimeNextMonth":
        actual = partsOf(t.sameTimeNextMonth(),);
        break;
      case "sameTimeNextQuarter":
        actual = partsOf(t.sameTimeNextQuarter(),);
        break;
      case "sameTimeNextYear":
        actual = partsOf(t.sameTimeNextYear(),);
        break;
      case "sameTimeNextHour":
        actual = partsOf(t.sameTimeNextHour(),);
        break;
      case "to_s":
        actual = t.to_s();
        break;
      case "collectIntervals": {
        const end = c.end
          ? TjTime.fromParts(c.end.year, c.end.month, c.end.day, c.end.hour, c.end.minute, c.end.second,)
          : undefined;
        const step = c.step ?? 1;
        const intervals = t.collectIntervals(end, step,);
        actual = intervals.map((iv,) => ({
          start: iv.start.to_s(undefined, c.timezone ?? "UTC",),
          end: iv.end.to_s(undefined, c.timezone ?? "UTC",),
        }));
        break;
      }
      case "beginOfHour":
        actual = partsOf(t.beginOfHour(),);
        break;
      case "midnight":
        actual = partsOf(t.midnight(),);
        break;
      case "beginOfWeek":
        actual = partsOf(t.beginOfWeek(!c.description.includes("Sunday start"),),);
        break;
      case "beginOfMonth":
        actual = partsOf(t.beginOfMonth(),);
        break;
      case "beginOfQuarter":
        actual = partsOf(t.beginOfQuarter(),);
        break;
      case "beginOfYear":
        actual = partsOf(t.beginOfYear(),);
        break;
      case "wday":
        actual = t.wday();
        break;
      case "hour":
        actual = t.hour();
        break;
      case "day":
        actual = t.day();
        break;
      case "month":
        actual = t.month();
        break;
      case "year":
        actual = t.year();
        break;
      case "to_a":
        actual = t.to_a();
        break;
      case "strftime": {
        const tz = c.timezone ?? "UTC";
        const formatMatch = c.description.match(/strftime (\%\w+|%%)/,);
        const format = formatMatch ? formatMatch[1]! : "%Y";
        actual = t.strftime(format, tz,);
        break;
      }
      case "compareTo": {
        const compareWith = c.compareWith;
        if (!compareWith) {
          throw new Error(`Missing compareWith for compareTo case: ${c.description}`);
        }
        actual = t.compareTo(TjTime.fromParts(
          compareWith.year,
          compareWith.month,
          compareWith.day,
          compareWith.hour,
          compareWith.minute,
          compareWith.second,
        ));
        break;
      }
      case "secondsOfDay": {
        const tz = c.timezone ?? "UTC";
        actual = t.secondsOfDay(tz);
        break;
      }
      case "lastDayOfMonth": {
        const month = c.input.month;
        const year = c.input.year;
        actual = TjTime.lastDayOfMonth(month, year);
        break;
      }
      case "utc": {
        actual = partsOf(t.utc());
        break;
      }
      case "localtime": {
        actual = partsOf(t.localtime());
        break;
      }
      case "gmtime": {
        actual = partsOf(t.gmtime());
        break;
      }
      default:
        throw new Error(`Unknown method in golden file: ${c.method}`,);
    }

    assertEquals(
      actual,
      c.expected,
      `Golden case "${c.description}" failed for method ${c.method} (keepRubyBugs=${keepRubyBugs})`,
    );
  } finally {
    compat.keepRubyBugs = originalKeepRubyBugs;
  }
}

describe("Compat golden tests (keepRubyBugs=true)", () => {
  const golden = loadGoldenFile("./tjtime.golden.json");

  for (const c of golden.cases) {
    it(`${c.method}: ${c.description}`, () => {
      runCase(c, true,);
    });
  }
});

describe("Compat golden tests (keepRubyBugs=false)", () => {
  const golden = loadGoldenFile("./compat-fix.golden.json");

  for (const c of golden.cases) {
    it(`${c.method}: ${c.description}`, () => {
      runCase(c, false,);
    });
  }
});
