import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertNotEquals, } from "@std/assert";
import { TjTime, } from "../../src/time/tj-time.ts";

describe("TjTime differences", () => {
  describe("hoursTo method", () => {
    it("calculates hours between two times", () => {
      const start = TjTime.fromString("2026-01-01-12:00",);
      const end = TjTime.fromString("2026-01-01-14:00",);
      assertEquals(start.hoursTo(end,), 2,);
    });

    it("handles fractional hours correctly", () => {
      const start = TjTime.fromString("2026-01-01-12:00",);
      const end = TjTime.fromString("2026-01-01-12:30",);
      assertEquals(start.hoursTo(end,), 1,); // Should round up to 1 hour
    });

    it("returns negative when end < start", () => {
      const start = TjTime.fromString("2026-01-01-14:00",);
      const end = TjTime.fromString("2026-01-01-12:00",);
      assertEquals(start.hoursTo(end,), -2,);
    });
  });

  describe("daysTo method", () => {
    it("calculates days between two times", () => {
      const start = TjTime.fromString("2026-01-01",);
      const end = TjTime.fromString("2026-01-03",);
      assertEquals(start.daysTo(end,), 2,);
    });

    it("is symmetric", () => {
      const start = TjTime.fromString("2026-01-01",);
      const end = TjTime.fromString("2026-01-03",);
      assertEquals(start.daysTo(end,), end.daysTo(start,),);
    });

    it("handles edge cases", () => {
      const start = TjTime.fromString("2026-01-01-23:59",);
      const end = TjTime.fromString("2026-01-02-00:01",);
      assertEquals(start.daysTo(end,), 1,);
    });
  });

  describe("weeksTo method", () => {
    it("calculates weeks between two times", () => {
      const start = TjTime.fromString("2026-01-01",);
      const end = TjTime.fromString("2026-01-15",);
      assertEquals(start.weeksTo(end,), 2,);
    });

    it("is symmetric", () => {
      const start = TjTime.fromString("2026-01-01",);
      const end = TjTime.fromString("2026-01-15",);
      assertEquals(start.weeksTo(end,), end.weeksTo(start,),);
    });
  });

  describe("monthsTo method", () => {
    it("calculates months between two times", () => {
      const start = TjTime.fromString("2026-01-01",);
      const end = TjTime.fromString("2026-03-01",);
      assertEquals(start.monthsTo(end,), 2,);
    });

    it("is symmetric", () => {
      const start = TjTime.fromString("2026-01-01",);
      const end = TjTime.fromString("2026-03-01",);
      assertEquals(start.monthsTo(end,), end.monthsTo(start,),);
    });

    it("handles different days of month", () => {
      const start = TjTime.fromString("2026-01-15",);
      const end = TjTime.fromString("2026-03-15",);
      assertEquals(start.monthsTo(end,), 2,);
    });
  });

  describe("quartersTo method", () => {
    it("calculates quarters between two times", () => {
      const start = TjTime.fromString("2026-01-01",);
      const end = TjTime.fromString("2026-07-01",);
      assertEquals(start.quartersTo(end,), 2,);
    });

    it("is symmetric", () => {
      const start = TjTime.fromString("2026-01-01",);
      const end = TjTime.fromString("2026-07-01",);
      assertEquals(start.quartersTo(end,), end.quartersTo(start,),);
    });
  });

  describe("yearsTo method", () => {
    it("calculates years between two times", () => {
      const start = TjTime.fromString("2026-01-01",);
      const end = TjTime.fromString("2028-01-01",);
      assertEquals(start.yearsTo(end,), 2,);
    });

    it("is symmetric", () => {
      const start = TjTime.fromString("2026-01-01",);
      const end = TjTime.fromString("2028-01-01",);
      assertEquals(start.yearsTo(end,), end.yearsTo(start,),);
    });
  });

  describe("aggregate test", () => {
    it("verifies symmetry for 20 random pairs", () => {
      const dates = [
        "2026-01-01",
        "2026-01-15",
        "2026-02-01",
        "2026-02-15",
        "2026-03-01",
        "2026-03-15",
        "2026-04-01",
        "2026-04-15",
        "2026-05-01",
        "2026-05-15",
        "2026-06-01",
        "2026-06-15",
        "2026-07-01",
        "2026-07-15",
        "2026-08-01",
        "2026-08-15",
        "2026-09-01",
        "2026-09-15",
        "2026-10-01",
        "2026-10-15",
      ];

      for (let i = 0; i < dates.length; i++) {
        for (let j = i + 1; j < dates.length; j++) {
          const t1 = TjTime.fromString(dates[i]!,);
          const t2 = TjTime.fromString(dates[j]!,);

          assertEquals(t1.daysTo(t2,), t2.daysTo(t1,),);
          assertEquals(t1.weeksTo(t2,), t2.weeksTo(t1,),);
          assertEquals(t1.monthsTo(t2,), t2.monthsTo(t1,),);
          assertEquals(t1.quartersTo(t2,), t2.quartersTo(t1,),);
          assertEquals(t1.yearsTo(t2,), t2.yearsTo(t1,),);
        }
      }
    });
  });
});
