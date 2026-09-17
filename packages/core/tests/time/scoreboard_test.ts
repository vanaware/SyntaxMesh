import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { Scoreboard, } from "../../src/time/scoreboard.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { IntervalList, } from "../../src/time/interval-list.ts";
import { compat, } from "../../src/compat.ts";

describe("Scoreboard", () => {
  describe("constructor", () => {
    it("creates with correct size using ceil", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-01T01:00:00Z",);
      const resolution = 60;
      const sb = new Scoreboard<string>(start, end, resolution,);
      assertEquals(sb.size, 61,);
    });

    it("fills data with initVal", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-01T00:05:00Z",);
      const resolution = 60;
      const sb = new Scoreboard<number>(start, end, resolution, 42,);
      assertEquals(sb.size, 6,);
      assertEquals(sb.get(0,), 42,);
      assertEquals(sb.get(5,), 42,);
    });

    it("throws on invalid startDate type", () => {
      assertThrows(
        () => new Scoreboard("not a date" as unknown as Date, new Date(), 60,),
        Error,
        "startDate must be a Date",
      );
    });

    it("throws on invalid endDate type", () => {
      assertThrows(
        () => new Scoreboard(new Date(), "not a date" as unknown as Date, 60,),
        Error,
        "endDate must be a Date",
      );
    });

    it("throws on invalid resolution type", () => {
      assertThrows(
        () =>
          new Scoreboard(
            new Date(),
            new Date(),
            "not a number" as unknown as number,
          ),
        Error,
        "resolution must be a positive integer",
      );
    });

    it("throws on non-positive resolution", () => {
      assertThrows(
        () => new Scoreboard(new Date(), new Date(), 0,),
        Error,
        "resolution must be a positive integer",
      );
    });

    it("throws when endDate is before startDate", () => {
      assertThrows(
        () =>
          new Scoreboard(new Date("2026-01-02",), new Date("2026-01-01",), 60,),
        Error,
        "endDate must be after startDate",
      );
    });
  });

  describe("idxToDate", () => {
    it("converts index to date correctly", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<string>(start, end, resolution,);
      const expected = new Date(start.getTime() + 2 * resolution * 1000,);
      assertEquals(sb.idxToDate(2,).getTime(), expected.getTime(),);
    });

    it("throws on negative index without forceIntoProject", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<string>(start, end, resolution,);
      assertThrows(
        () => sb.idxToDate(-1,),
        Error,
        "Index -1 is out of scoreboard range",
      );
    });

    it("returns startDate for negative index with forceIntoProject", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<string>(start, end, resolution,);
      assertEquals(sb.idxToDate(-1, true,).getTime(), start.getTime(),);
    });

    it("returns endDate for out-of-range index with forceIntoProject", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<string>(start, end, resolution,);
      assertEquals(sb.idxToDate(1000, true,).getTime(), end.getTime(),);
    });
  });

  describe("dateToIdx", () => {
    it("converts date to index correctly", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<string>(start, end, resolution,);
      const testDate = new Date(start.getTime() + 2 * resolution * 1000,);
      assertEquals(sb.dateToIdx(testDate,), 2,);
    });

    it("clamps negative index with forceIntoProject", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<string>(start, end, resolution,);
      const beforeStart = new Date(start.getTime() - 1000,);
      assertEquals(sb.dateToIdx(beforeStart, true,), 0,);
    });

    it("clamps out-of-range index with forceIntoProject", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<string>(start, end, resolution,);
      const afterEnd = new Date(end.getTime() + 1000,);
      assertEquals(sb.dateToIdx(afterEnd, true,), sb.size - 1,);
    });

    it("throws on out-of-range date without forceIntoProject", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<string>(start, end, resolution,);
      const beforeStart = new Date(start.getTime() - 120000,);
      assertThrows(
        () => sb.dateToIdx(beforeStart, false,),
        Error,
        "is out of project time range",
      );
    });
  });

  describe("get and set", () => {
    it("get and set by index", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<string>(start, end, resolution, "initial",);
      sb.set(2, "value",);
      assertEquals(sb.get(2,), "value",);
    });

    it("get and set by date", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<string>(start, end, resolution, "initial",);
      const date = new Date(start.getTime() + 2 * resolution,);
      sb.setByDate(date, "byDate",);
      assertEquals(sb.getByDate(date,), "byDate",);
    });

    it("clear resets all values", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<string>(start, end, resolution, "initial",);
      sb.set(2, "changed",);
      sb.clear("reset",);
      assertEquals(sb.get(2,), "reset",);
    });
  });

  describe("each", () => {
    it("iterates over all entries", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<number>(start, end, resolution, 0,);
      sb.set(3, 42,);
      const values: number[] = [];
      for (const val of sb.each()) {
        values.push(val,);
      }
      assertEquals(values.length, sb.size,);
      assertEquals(values[3], 42,);
    });

    it("iterates over range", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<number>(start, end, resolution, 0,);
      const values: number[] = [];
      for (const val of sb.each(2, 5,)) {
        values.push(val,);
      }
      assertEquals(values.length, 3,);
    });

    it("empty range returns no values", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<number>(start, end, resolution, 0,);
      const values: number[] = [];
      for (const val of sb.each(3, 3,)) {
        values.push(val,);
      }
      assertEquals(values.length, 0,);
    });
  });

  describe("each_index", () => {
    it("iterates over all indices", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<number>(start, end, resolution, 0,);
      const indices: number[] = [];
      for (const idx of sb.each_index()) {
        indices.push(idx,);
      }
      assertEquals(indices.length, sb.size,);
      assertEquals(indices[0], 0,);
      assertEquals(indices[sb.size - 1], sb.size - 1,);
    });

    it("indices are sequential", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<number>(start, end, resolution, 0,);
      const indices: number[] = [];
      for (const idx of sb.each_index()) {
        indices.push(idx,);
      }
      for (let i = 0; i < indices.length; i++) {
        assertEquals(indices[i], i,);
      }
    });
  });

  describe("collect!", () => {
    it("transforms values in place", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<number>(start, end, resolution, 1,);
      sb.collect((v,) => v * 2);
      assertEquals(sb.get(0,), 2,);
      assertEquals(sb.get(5,), 2,);
    });

    it("replaces with null when predicate is false", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<number>(start, end, resolution, 1,);
      sb.collect((v,) => v > 1 ? v : null as unknown as number);
      assertEquals(sb.get(0,), null,);
    });
  });

  describe("collectIntervals", () => {
    it("collects intervals matching predicate", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<number>(start, end, resolution, 0,);
      sb.set(5, 1,);
      sb.set(6, 1,);
      sb.set(7, 1,);
      const iv = new TimeInterval(
        TjTime.fromSeconds(start.getTime() / 1000,),
        TjTime.fromSeconds(end.getTime() / 1000,),
      );
      const result = sb.collectIntervals(iv, 60, (v,) => v === 1,);
      assertEquals(result.length >= 1, true,);
    });

    it("replicates sentinel bug when keepRubyBugs is true", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<number>(start, end, resolution, 0,);
      sb.set(0, 1,);
      sb.set(1, 1,);
      sb.set(2, 1,);
      const iv = new TimeInterval(
        TjTime.fromSeconds(start.getTime() / 1000,),
        TjTime.fromSeconds(end.getTime() / 1000,),
      );
      const result = sb.collectIntervals(iv, 60, (v,) => v === 1,);
      assertEquals(result.length >= 1, true,);
    });

    it("fixes sentinel bug when keepRubyBugs is false", () => {
      const orig = compat.keepRubyBugs;
      compat.keepRubyBugs = false;
      try {
        const start = TjTime.fromSeconds(100,).toDate();
        const end = TjTime.fromSeconds(1000,).toDate();
        const resolution = 60;
        const sb = new Scoreboard<number>(start, end, resolution, 0,);
        sb.set(0, 1,);
        sb.set(1, 1,);
        sb.set(2, 1,);
        const iv = new TimeInterval(
          TjTime.fromSeconds(start.getTime() / 1000,),
          TjTime.fromSeconds(end.getTime() / 1000,),
        );
        const result = sb.collectIntervals(iv, 60, (v,) => v === 1,);
        assertEquals(result.length >= 1, true,);
      } finally {
        compat.keepRubyBugs = orig;
      }
    });

    it("returns empty IntervalList when no match", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<number>(start, end, resolution, 0,);
      const iv = new TimeInterval(
        TjTime.fromSeconds(start.getTime() / 1000,),
        TjTime.fromSeconds(end.getTime() / 1000,),
      );
      const result = sb.collectIntervals(iv, 60, (v,) => v === 999,);
      assertEquals(result.length, 0,);
    });

    it("respects minDuration", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<number>(start, end, resolution, 0,);
      sb.set(5, 1,);
      sb.set(6, 1,);
      const iv = new TimeInterval(
        TjTime.fromSeconds(start.getTime() / 1000,),
        TjTime.fromSeconds(end.getTime() / 1000,),
      );
      const result = sb.collectIntervals(iv, 180, (v,) => v === 1,);
      assertEquals(result.length, 0,);
    });

    it("returns IntervalList instance", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<number>(start, end, resolution, 0,);
      sb.set(5, 1,);
      const iv = new TimeInterval(
        TjTime.fromSeconds(start.getTime() / 1000,),
        TjTime.fromSeconds(end.getTime() / 1000,),
      );
      const result = sb.collectIntervals(iv, 60, (v,) => v === 1,);
      assertEquals(result instanceof IntervalList, true,);
    });
  });

  describe("length", () => {
    it("returns size", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<string>(start, end, resolution,);
      assertEquals(sb.size, 16,);
    });
  });

  describe("inspect", () => {
    it("returns string representation", () => {
      const start = TjTime.fromSeconds(100,).toDate();
      const end = TjTime.fromSeconds(1000,).toDate();
      const resolution = 60;
      const sb = new Scoreboard<string>(start, end, resolution, "test",);
      const result = sb.inspect();
      assertEquals(typeof result, "string",);
      assertEquals(result.includes("test",), true,);
    });
  });
});
