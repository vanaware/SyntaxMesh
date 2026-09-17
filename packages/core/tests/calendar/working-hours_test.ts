import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { WorkingHours, } from "../../src/calendar/working-hours.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";

describe("WorkingHours", () => {
  describe("constructor", () => {
    it("creates with 4 args", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end, "UTC",);
      assertEquals(wh.slotDuration, 300,);
      assertEquals(wh.startDate.getTime(), start.getTime(),);
      assertEquals(wh.endDate.getTime(), end.getTime(),);
      assertEquals(wh.timezone, "UTC",);
    });

    it("creates copy from WorkingHours", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const original = new WorkingHours(300, start, end,);
      const copy = new WorkingHours(original,);
      assertEquals(copy.slotDuration, 300,);
      assertEquals(copy.startDate.getTime(), start.getTime(),);
      assertEquals(copy.endDate.getTime(), end.getTime(),);
      assertEquals(copy.timezone, null,);
    });

    it("throws when missing required args", () => {
      assertThrows(
        () =>
          new WorkingHours(
            undefined as unknown as number,
            undefined as unknown as Date,
            undefined as unknown as Date,
          ),
        Error,
        "You must supply values for slotDuration, start and end dates",
      );
    });

    it("sets default working hours Mon-Fri 9-17", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      for (let day = 1; day <= 5; day++) {
        assertEquals(wh.days[day]!.length, 1,);
        assertEquals(wh.days[day]![0]![0], 9 * 60 * 60,);
        assertEquals(wh.days[day]![0]![1], 17 * 60 * 60,);
      }
    });
  });

  describe("@days structure", () => {
    it("has 7 entries", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      assertEquals(wh.days.length, 7,);
    });

    it("Sunday and Saturday are empty", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      assertEquals(wh.days[0]!.length, 0,);
      assertEquals(wh.days[6]!.length, 0,);
    });
  });

  describe("copy constructor deep copy", () => {
    it("days intervals are independent copies", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const original = new WorkingHours(300, start, end,);
      const copy = new WorkingHours(original,);
      original.setWorkingHours(1, [[10 * 60 * 60, 18 * 60 * 60,],],);
      assertEquals(copy.days[1]![0]![0], 9 * 60 * 60,);
      assertEquals(copy.days[1]![0]![1], 17 * 60 * 60,);
    });

    it("scoreboard is shared (copy-on-write)", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const original = new WorkingHours(300, start, end,);
      const copy = new WorkingHours(original,);
      original.onShift(TjTime.fromDate(start,),);
      assertEquals(copy.scoreboard === original.scoreboard, true,);
    });

    it("setting working hours on copy breaks share", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const original = new WorkingHours(300, start, end,);
      const copy = new WorkingHours(original,);
      original.onShift(TjTime.fromDate(start,),);
      copy.setWorkingHours(1, [[10 * 60 * 60, 18 * 60 * 60,],],);
      assertEquals(copy.scoreboard, null,);
      assertEquals(original.scoreboard !== null, true,);
    });
  });

  describe("setWorkingHours", () => {
    it("sets intervals for valid dayOfWeek", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      wh.setWorkingHours(0, [[8 * 60 * 60, 16 * 60 * 60,],],);
      assertEquals(wh.days[0]!.length, 1,);
      assertEquals(wh.days[0]![0]![0], 8 * 60 * 60,);
      assertEquals(wh.days[0]![0]![1], 16 * 60 * 60,);
    });

    it("throws for dayOfWeek < 0", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      assertThrows(
        () => wh.setWorkingHours(-1, [[9 * 60 * 60, 17 * 60 * 60,],],),
        Error,
        "dayOfWeek out of range: -1",
      );
    });

    it("throws for dayOfWeek > 6", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      assertThrows(
        () => wh.setWorkingHours(7, [[9 * 60 * 60, 17 * 60 * 60,],],),
        Error,
        "dayOfWeek out of range: 7",
      );
    });

    it("throws when interval end <= start", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      assertThrows(
        () => wh.setWorkingHours(1, [[17 * 60 * 60, 9 * 60 * 60,],],),
        Error,
        "Interval end time must be larger than start time",
      );
    });

    it("throws when interval values out of range", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      assertThrows(
        () => wh.setWorkingHours(1, [[-1, 17 * 60 * 60,],],),
        Error,
        "Time interval has illegal values",
      );
    });

    it("resets scoreboard when called", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      wh.onShift(TjTime.fromDate(start,),);
      assertEquals(wh.scoreboard !== null, true,);
      wh.setWorkingHours(1, [[10 * 60 * 60, 18 * 60 * 60,],],);
      assertEquals(wh.scoreboard, null,);
    });
  });

  describe("getWorkingHours", () => {
    it("returns intervals for a day", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      const hours = wh.getWorkingHours(1,);
      assertEquals(hours.length, 1,);
      assertEquals(hours[0]![0], 9 * 60 * 60,);
      assertEquals(hours[0]![1], 17 * 60 * 60,);
    });
  });

  describe("onShift?", () => {
    it("returns true for working slot", () => {
      const start = new Date("2026-01-05T09:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      assertEquals(wh.onShift(TjTime.fromDate(start,),), true,);
    });

    it("returns false for non-working slot", () => {
      const start = new Date("2026-01-05T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      const saturday9am = new Date("2026-01-07T09:00:00Z",);
      assertEquals(wh.onShift(TjTime.fromDate(saturday9am,),), false,);
    });

    it("accepts number index", () => {
      const start = new Date("2026-01-05T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      assertEquals(wh.onShift(0,), false,);
    });

    it("lazy initScoreboard", () => {
      const start = new Date("2026-01-05T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      assertEquals(wh.scoreboard, null,);
      wh.onShift(TjTime.fromDate(start,),);
      assertEquals(wh.scoreboard !== null, true,);
    });
  });

  describe("timeOff?", () => {
    it("returns true when all slots are off", () => {
      const start = new Date("2026-01-05T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      const interval = new TimeInterval(
        TjTime.fromDate(new Date("2026-01-07T00:00:00Z",),),
        TjTime.fromDate(new Date("2026-01-07T12:00:00Z",),),
      );
      assertEquals(wh.timeOff(interval,), true,);
    });

    it("returns false when any slot is on", () => {
      const start = new Date("2026-01-05T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      const interval = new TimeInterval(
        TjTime.fromDate(new Date("2026-01-05T08:00:00Z",),),
        TjTime.fromDate(new Date("2026-01-05T10:00:00Z",),),
      );
      assertEquals(wh.timeOff(interval,), false,);
    });

    it("returns true for empty interval", () => {
      const start = new Date("2026-01-05T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      const interval = new TimeInterval(
        TjTime.fromDate(new Date("2026-01-05T00:00:00Z",),),
        TjTime.fromDate(new Date("2026-01-05T00:00:00Z",),),
      );
      assertEquals(wh.timeOff(interval,), true,);
    });
  });

  describe("weeklyWorkingHours", () => {
    it("returns 40 for default Mon-Fri 9-17", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      assertEquals(wh.weeklyWorkingHours(), 40,);
    });

    it("returns 0 for all days off", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      for (let day = 0; day < 7; day++) {
        wh.setWorkingHours(day, [],);
      }
      assertEquals(wh.weeklyWorkingHours(), 0,);
    });

    it("sums multiple intervals per day", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      wh.setWorkingHours(1, [[9 * 60 * 60, 12 * 60 * 60,], [
        13 * 60 * 60,
        17 * 60 * 60,
      ],],);
      assertEquals(wh.weeklyWorkingHours(), 39,);
    });
  });

  describe("to_s", () => {
    it("returns string representation", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      const expected =
        "Sun: off\nMon: 9:0 - 17:0\nTue: 9:0 - 17:0\nWed: 9:0 - 17:0\nThu: 9:0 - 17:0\nFri: 9:0 - 17:0\nSat: off";
      assertEquals(wh.to_s(), expected,);
    });
  });

  describe("equals", () => {
    it("returns true for identical objects", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh1 = new WorkingHours(300, start, end,);
      const wh2 = new WorkingHours(300, start, end,);
      assertEquals(wh1.equals(wh2,), true,);
    });

    it("returns false for different slotDuration", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh1 = new WorkingHours(300, start, end,);
      const wh2 = new WorkingHours(600, start, end,);
      assertEquals(wh1.equals(wh2,), false,);
    });
  });

  describe("deepClone", () => {
    it("creates independent copy", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const original = new WorkingHours(300, start, end,);
      const clone = original.deepClone();
      original.setWorkingHours(1, [[10 * 60 * 60, 18 * 60 * 60,],],);
      assertEquals(clone.days[1]![0]![0], 9 * 60 * 60,);
      assertEquals(clone.days[1]![0]![1], 17 * 60 * 60,);
    });
  });

  describe("timezone setter", () => {
    it("sets timezone and invalidates scoreboard", () => {
      const start = new Date("2026-01-01T00:00:00Z",);
      const end = new Date("2026-01-07T00:00:00Z",);
      const wh = new WorkingHours(300, start, end,);
      wh.onShift(TjTime.fromDate(start,),);
      assertEquals(wh.scoreboard !== null, true,);
      wh.timezone = "UTC";
      assertEquals(wh.timezone, "UTC",);
      assertEquals(wh.scoreboard, null,);
    });
  });
});
