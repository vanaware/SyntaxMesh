import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import { TjTime, TjArgumentError } from "../../src/time/tj-time.ts";

describe("TjTime advances", () => {
  describe("hoursLater", () => {
    it("adds seconds correctly", () => {
      const t = TjTime.fromString("2026-01-01-12:00:00");
      const result = t.hoursLater(1);
      assertEquals(result.toSeconds(), TjTime.fromString("2026-01-01-13:00:00").toSeconds());
    });

    it("adds multiple hours", () => {
      const t = TjTime.fromString("2026-01-01-12:00:00");
      const result = t.hoursLater(5);
      assertEquals(result.toSeconds(), TjTime.fromString("2026-01-01-17:00:00").toSeconds());
    });
  });

  describe("sameTimeNextHour", () => {
    it("advances one hour", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45");
      const result = t.sameTimeNextHour();
      assertEquals(result.toSeconds(), TjTime.fromString("2026-01-15-15:30:45").toSeconds());
    });

    it("wraps to next day at midnight", () => {
      const t = TjTime.fromString("2026-01-15-23:30:45");
      const result = t.sameTimeNextHour();
      assertEquals(result.toSeconds(), TjTime.fromString("2026-01-16-00:30:45").toSeconds());
    });
  });

  describe("sameTimeNextDay", () => {
    it("advances one day", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45");
      const result = t.sameTimeNextDay();
      assertEquals(result.toSeconds(), TjTime.fromString("2026-01-16-14:30:45").toSeconds());
    });

    it("handles month end overflow (jan 31 -> feb 1)", () => {
      const t = TjTime.fromString("2026-01-31-14:30:45");
      const result = t.sameTimeNextDay();
      assertEquals(result.toSeconds(), TjTime.fromString("2026-02-01-14:30:45").toSeconds());
    });

    it("handles february non-leap year", () => {
      const t = TjTime.fromString("2026-02-28-14:30:45");
      const result = t.sameTimeNextDay();
      assertEquals(result.toSeconds(), TjTime.fromString("2026-03-01-14:30:45").toSeconds());
    });

    it("handles february leap year", () => {
      const t = TjTime.fromString("2024-02-29-14:30:45");
      const result = t.sameTimeNextDay();
      assertEquals(result.toSeconds(), TjTime.fromString("2024-03-01-14:30:45").toSeconds());
    });

    it("handles year end overflow (dec 31 -> jan 1)", () => {
      const t = TjTime.fromString("2026-12-31-14:30:45");
      const result = t.sameTimeNextDay();
      assertEquals(result.toSeconds(), TjTime.fromString("2027-01-01-14:30:45").toSeconds());
    });
  });

  describe("sameTimeNextWeek", () => {
    it("advances one week with month overflow", () => {
      // 28/jan + 7 days = 35 > 31 -> 4/fev
      const t = TjTime.fromString("2026-01-28-14:30:45");
      const result = t.sameTimeNextWeek();
      assertEquals(result.toSeconds(), TjTime.fromString("2026-02-04-14:30:45").toSeconds());
    });

    it("advances week at month boundary", () => {
      // 25/jan + 7 = 32 > 31 -> 1/fev
      const t = TjTime.fromString("2026-01-25-14:30:45");
      const result = t.sameTimeNextWeek();
      assertEquals(result.toSeconds(), TjTime.fromString("2026-02-01-14:30:45").toSeconds());
    });

    it("crosses year boundary", () => {
      // 30/dez + 7 = 37 > 31 -> 6/jan next year
      const t = TjTime.fromString("2026-12-30-14:30:45");
      const result = t.sameTimeNextWeek();
      assertEquals(result.toSeconds(), TjTime.fromString("2027-01-06-14:30:45").toSeconds());
    });

    it("stays within same month when no overflow", () => {
      // 15/jan + 7 = 22, still in january
      const t = TjTime.fromString("2026-01-15-14:30:45");
      const result = t.sameTimeNextWeek();
      assertEquals(result.toSeconds(), TjTime.fromString("2026-01-22-14:30:45").toSeconds());
    });

    it("handles february leap year week", () => {
      // 24/fev (leap) + 7 = 31 > 29 -> 5/mar
      const t = TjTime.fromString("2024-02-24-14:30:45");
      const result = t.sameTimeNextWeek();
      assertEquals(result.toSeconds(), TjTime.fromString("2024-03-05-14:30:45").toSeconds());
    });
  });

  describe("sameTimeNextMonth", () => {
    it("advances one month, keeps day when possible", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45");
      const result = t.sameTimeNextMonth();
      assertEquals(result.toSeconds(), TjTime.fromString("2026-02-15-14:30:45").toSeconds());
    });

    it("handles day rollover when new month has fewer days", () => {
      const t = TjTime.fromString("2026-01-31-14:30:45");
      const result = t.sameTimeNextMonth();
      assertEquals(result.toSeconds(), TjTime.fromString("2026-02-28-14:30:45").toSeconds());
    });

    it("handles month end to year boundary", () => {
      const t = TjTime.fromString("2026-12-31-14:30:45");
      const result = t.sameTimeNextMonth();
      assertEquals(result.toSeconds(), TjTime.fromString("2027-01-31-14:30:45").toSeconds());
    });

    it("handles 31st of month to month with 30 days", () => {
      const t = TjTime.fromString("2026-05-31-14:30:45");
      const result = t.sameTimeNextMonth();
      assertEquals(result.toSeconds(), TjTime.fromString("2026-06-30-14:30:45").toSeconds());
    });
  });

  describe("sameTimeNextQuarter", () => {
    it("advances one quarter without clamp", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45");
      const result = t.sameTimeNextQuarter();
      assertEquals(result.toSeconds(), TjTime.fromString("2026-04-15-14:30:45").toSeconds());
    });

    it("wraps quarter at year boundary", () => {
      const t = TjTime.fromString("2026-10-15-14:30:45");
      const result = t.sameTimeNextQuarter();
      assertEquals(result.toSeconds(), TjTime.fromString("2027-01-15-14:30:45").toSeconds());
    });

    it("handles 31st day rollover in quarter advance", () => {
      const t = TjTime.fromString("2026-01-31-14:30:45");
      const result = t.sameTimeNextQuarter();
      assertEquals(result.toSeconds(), TjTime.fromString("2026-04-31-14:30:45").toSeconds());
    });
  });

  describe("sameTimeNextYear", () => {
    it("advances one year", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45");
      const result = t.sameTimeNextYear();
      assertEquals(result.toSeconds(), TjTime.fromString("2027-01-15-14:30:45").toSeconds());
    });

    it("handles february 29 leap year rollover to non-leap", () => {
      const t = TjTime.fromString("2024-02-29-14:30:45");
      const result = t.sameTimeNextYear();
      assertEquals(result.toSeconds(), TjTime.fromString("2025-03-01-14:30:45").toSeconds());
    });

    it("keeps same month and day when valid", () => {
      const t = TjTime.fromString("2026-06-15-14:30:45");
      const result = t.sameTimeNextYear();
      assertEquals(result.toSeconds(), TjTime.fromString("2027-06-15-14:30:45").toSeconds());
    });
  });

  describe("nextDayOfWeek", () => {
    it("finds next monday", () => {
      const t = TjTime.fromString("2026-01-18-14:30:45");
      const result = t.nextDayOfWeek(1);
      assertEquals(result.toSeconds(), TjTime.fromString("2026-01-19-14:30:45").toSeconds());
    });

    it("finds next tuesday from monday", () => {
      const t = TjTime.fromString("2026-01-12-14:30:45");
      const result = t.nextDayOfWeek(2);
      assertEquals(result.toSeconds(), TjTime.fromString("2026-01-13-14:30:45").toSeconds());
    });

    it("finds next sunday from saturday", () => {
      const t = TjTime.fromString("2026-01-17-14:30:45");
      const result = t.nextDayOfWeek(0);
      assertEquals(result.toSeconds(), TjTime.fromString("2026-01-18-14:30:45").toSeconds());
    });

    it("finds next wednesday from monday (3 days later)", () => {
      const t = TjTime.fromString("2026-01-12-14:30:45");
      const result = t.nextDayOfWeek(3);
      assertEquals(result.toSeconds(), TjTime.fromString("2026-01-15-14:30:45").toSeconds());
    });

    it("validates dow range", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45");
      assertThrows(() => t.nextDayOfWeek(7));
      assertThrows(() => t.nextDayOfWeek(-1));
    });
  });

  describe("normalization preservation", () => {
    it("hoursLater preserves hour/min/sec", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45");
      const result = t.hoursLater(2);
      const parts = result.to_a();
      assertEquals(parts[3], 16);
      assertEquals(parts[4], 30);
      assertEquals(parts[5], 45);
    });

    it("sameTimeNextDay preserves hour/min/sec", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45");
      const result = t.sameTimeNextDay();
      const parts = result.to_a();
      assertEquals(parts[3], 14);
      assertEquals(parts[4], 30);
      assertEquals(parts[5], 45);
    });
  });

  describe("lastDayOfMonth", () => {
    it("february non-leap year", () => {
      assertEquals(TjTime.lastDayOfMonth(2, 2026), 28);
    });

    it("february leap year", () => {
      assertEquals(TjTime.lastDayOfMonth(2, 2024), 29);
    });

    it("april (month 4)", () => {
      assertEquals(TjTime.lastDayOfMonth(4, 2026), 30);
    });
  });

  describe("leapYear", () => {
    it("year 2000 is leap", () => {
      assertEquals(TjTime.isLeapYear(2000), true);
    });

    it("year 1900 is not leap", () => {
      assertEquals(TjTime.isLeapYear(1900), false);
    });

    it("year 2024 is leap", () => {
      assertEquals(TjTime.isLeapYear(2024), true);
    });

    it("year 2100 is not leap", () => {
      assertEquals(TjTime.isLeapYear(2100), false);
    });

    it("year 2400 is leap", () => {
      assertEquals(TjTime.isLeapYear(2400), true);
    });
  });
});