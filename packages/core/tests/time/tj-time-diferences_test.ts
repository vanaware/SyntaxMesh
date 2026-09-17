import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { TjTime, } from "../../src/time/tj-time.ts";

describe("TjTime diferenças", () => {
  describe("hoursTo", () => {
    it("calculates hours difference rounded up", () => {
      const t1 = TjTime.fromString("2026-01-01-12:00:00",);
      const t2 = TjTime.fromString("2026-01-01-14:30:00",);
      assertEquals(t1.hoursTo(t2,), 3,); // 12:00 to 14:30 = 2.5 hours, rounded up to 3
    });

    it("handles same time", () => {
      const t = TjTime.fromString("2026-01-01-12:00:00",);
      assertEquals(t.hoursTo(t,), 0,);
    });

    it("handles time crossing midnight", () => {
      const t1 = TjTime.fromString("2026-01-01-23:00:00",);
      const t2 = TjTime.fromString("2026-01-02-01:00:00",);
      assertEquals(t1.hoursTo(t2,), 2,); // 23:00 to 01:00 = 2 hours
    });
  });

  describe("daysTo", () => {
    it("calculates days difference rounded up", () => {
      const t1 = TjTime.fromString("2026-01-01-12:00:00",);
      const t2 = TjTime.fromString("2026-01-03-12:00:00",);
      assertEquals(t1.daysTo(t2,), 2,); // 12:00 to 12:00 = 2 days
    });

    it("handles same time", () => {
      const t = TjTime.fromString("2026-01-01-12:00:00",);
      assertEquals(t.daysTo(t,), 0,);
    });

    it("handles time crossing midnight", () => {
      const t1 = TjTime.fromString("2026-01-01-23:00:00",);
      const t2 = TjTime.fromString("2026-01-02-01:00:00",);
      assertEquals(t1.daysTo(t2,), 1,); // 23:00 to 01:00 = 1 day
    });
  });

  describe("weeksTo", () => {
    it("calculates weeks difference rounded up", () => {
      const t1 = TjTime.fromString("2026-01-01-12:00:00",);
      const t2 = TjTime.fromString("2026-01-15-12:00:00",);
      assertEquals(t1.weeksTo(t2,), 2,); // 14 days = 2 weeks
    });

    it("handles same time", () => {
      const t = TjTime.fromString("2026-01-01-12:00:00",);
      assertEquals(t.weeksTo(t,), 0,);
    });
  });

  describe("monthsTo", () => {
    it("calculates months difference rounded up", () => {
      const t1 = TjTime.fromString("2026-01-15-12:00:00",);
      const t2 = TjTime.fromString("2026-03-15-12:00:00",);
      assertEquals(t1.monthsTo(t2,), 2,); // January to March = 2 months
    });

    it("handles same time", () => {
      const t = TjTime.fromString("2026-01-15-12:00:00",);
      assertEquals(t.monthsTo(t,), 0,);
    });
  });

  describe("quartersTo", () => {
    it("calculates quarters difference rounded up", () => {
      const t1 = TjTime.fromString("2026-01-15-12:00:00",);
      const t2 = TjTime.fromString("2026-04-15-12:00:00",);
      assertEquals(t1.quartersTo(t2,), 1,); // Q1 to Q2 = 1 quarter
    });

    it("handles same time", () => {
      const t = TjTime.fromString("2026-01-15-12:00:00",);
      assertEquals(t.quartersTo(t,), 0,);
    });
  });

  describe("yearsTo", () => {
    it("calculates years difference rounded up", () => {
      const t1 = TjTime.fromString("2026-01-15-12:00:00",);
      const t2 = TjTime.fromString("2027-01-15-12:00:00",);
      assertEquals(t1.yearsTo(t2,), 1,); // 1 year difference
    });

    it("handles same time", () => {
      const t = TjTime.fromString("2026-01-15-12:00:00",);
      assertEquals(t.yearsTo(t,), 0,);
    });
  });
});
