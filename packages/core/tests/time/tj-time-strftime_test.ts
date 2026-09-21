import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { TjArgumentError, TjTime, } from "../../src/time/tj-time.ts";

describe("TjTime.strftime", () => {
  describe("minimum specifiers", () => {
    it("%Y - year 4 digits", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      assertEquals(t.strftime("%Y",), "2026",);
    });

    it("%m - month 2 digits", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      assertEquals(t.strftime("%m",), "01",);
    });

    it("%d - day 2 digits", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      assertEquals(t.strftime("%d",), "15",);
    });

    it("%H - hour 2 digits", () => {
      const t = TjTime.fromParts(2026, 1, 15, 14, 30, 45, "UTC",);
      assertEquals(t.strftime("%H",), "14",);
    });

    it("%M - minute 2 digits", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      assertEquals(t.strftime("%M",), "30",);
    });

    it("%S - second 2 digits", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      assertEquals(t.strftime("%S",), "45",);
    });

    it("%A - full weekday name", () => {
      // 2026-01-15 is Thursday
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      assertEquals(t.strftime("%A",), "Thursday",);
    });

    it("%a - abbreviated weekday name", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      assertEquals(t.strftime("%a",), "Thu",);
    });

    it("%B - full month name", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      assertEquals(t.strftime("%B",), "January",);
    });

    it("%b - abbreviated month name", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      assertEquals(t.strftime("%b",), "Jan",);
    });

    it("%z - UTC offset +HHMM/-HHMM", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      const result = t.strftime("%z",);
      // Should match +HHMM or -HHMM format
      assertEquals(typeof result, "string",);
      assertEquals(result.length, 5,);
      assertEquals(result[0] === "+" || result[0] === "-", true,);
    });

    it("%Q - quarter (1-4)", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      assertEquals(t.strftime("%Q",), "1",);
    });

    it("%Z - timezone abbreviation", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      const result = t.strftime("%Z",);
      // Should return a timezone abbreviation
      assertEquals(typeof result, "string",);
      assertEquals(result.length > 0, true,);
    });

    it("%% - literal percent sign", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      assertEquals(t.strftime("%%",), "%",);
    });
  });

  describe("%Q quarter calculation", () => {
    it("Q1: January-March returns 1", () => {
      const t = TjTime.fromString("2026-02-15-14:30:45",);
      assertEquals(t.strftime("%Q",), "1",);
    });

    it("Q2: April-June returns 2", () => {
      const t = TjTime.fromString("2026-05-15-14:30:45",);
      assertEquals(t.strftime("%Q",), "2",);
    });

    it("Q3: July-September returns 3", () => {
      const t = TjTime.fromString("2026-08-15-14:30:45",);
      assertEquals(t.strftime("%Q",), "3",);
    });

    it("Q4: October-December returns 4", () => {
      const t = TjTime.fromString("2026-11-15-14:30:45",);
      assertEquals(t.strftime("%Q",), "4",);
    });
  });

  describe("%z UTC offset", () => {
    it("returns +HHMM for positive offset", () => {
      // Use a timezone with positive offset
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      const result = t.strftime("%z", "Europe/Berlin",); // UTC+1 in winter
      assertEquals(result.startsWith("+",), true,);
      assertEquals(result.length, 5,);
    });

    it("returns -HHMM for negative offset", () => {
      // Use a timezone with negative offset
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      const result = t.strftime("%z", "America/New_York",); // UTC-5 in winter
      assertEquals(result.startsWith("-",), true,);
      assertEquals(result.length, 5,);
    });

    it("returns +0000 for UTC", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      const result = t.strftime("%z", "UTC",);
      assertEquals(result, "+0000",);
    });
  });

  describe("extended specifiers", () => {
    it("%x - date format (MM/DD/YY)", () => {
      const t = TjTime.fromParts(2026, 1, 15, 14, 30, 45, "UTC",);
      assertEquals(t.strftime("%x",), "01/15/26",);
    });

    it("%X - time format (HH:MM:SS)", () => {
      const t = TjTime.fromParts(2026, 1, 15, 14, 30, 45, "UTC",);
      assertEquals(t.strftime("%X",), "14:30:45",);
    });

    it("%p - AM/PM", () => {
      const t = TjTime.fromParts(2026, 1, 15, 14, 30, 45, "UTC",);
      assertEquals(t.strftime("%p",), "PM",);
    });
  });

  describe("invalid format throws TjArgumentError", () => {
    it("throws for unsupported specifier %c", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      assertThrows(
        () => t.strftime("%c",),
        TjArgumentError,
        "Invalid format specifier: %c",
      );
    });
  });
});

describe("TjTime.to_s", () => {
  describe("uses original seconds (this.seconds % 60) for :%S decision", () => {
    it("includes :%S when original seconds != 0", () => {
      // 45 seconds != 0, should include :%S
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      const result = t.to_s();
      assertEquals(result.includes(":",), true,);
      assertEquals(result.match(/:\d{2}-/,) !== null, true,); // has :SS-
    });

    it("excludes :%S when original seconds == 0", () => {
      // 0 seconds, should NOT include :%S
      const t = TjTime.fromString("2026-01-15-14:30:00",);
      const result = t.to_s();
      // Should NOT have :SS- (colon followed by 2 digits then dash for seconds)
      // The format is YYYY-MM-DD-HH:MM-+HHMM (no :SS- when seconds == 0)
      assertEquals(result.match(/:-\d{2}-/,) === null, true,); // no :SS- (seconds part)
      assertEquals(
        result.match(/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}-[+-]\d{4}$/,) !== null,
        true,
      ); // format: YYYY-MM-DD-HH:MM-+HHMM
    });
  });

  describe("default format", () => {
    it("format is %Y-%m-%d-%H:%M-%z when seconds == 0", () => {
      const t = TjTime.fromString("2026-01-15-14:30:00",);
      const result = t.to_s();
      // Should match: 2026-01-15-14:30-+HHMM
      assertEquals(
        result.match(/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}-[+-]\d{4}$/,) !== null,
        true,
      );
    });

    it("format is %Y-%m-%d-%H:%M:%S-%z when seconds != 0", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      const result = t.to_s();
      // Should match: 2026-01-15-14:30:45-+HHMM
      assertEquals(
        result.match(/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}:\d{2}-[+-]\d{4}$/,) !==
          null,
        true,
      );
    });

    it("includes timezone offset at end", () => {
      const t = TjTime.fromString("2026-01-15-14:30:00",);
      const result = t.to_s();
      assertEquals(result.match(/-[+-]\d{4}$/,) !== null, true,);
    });
  });

  describe("with tz='UTC' uses gmtime equivalent", () => {
    it("returns UTC time when tz='UTC'", () => {
      const t = TjTime.fromString("2026-01-15-14:30:00",);
      const result = t.to_s(undefined, "UTC",);
      // Should be in UTC timezone
      assertEquals(result.match(/-[+-]\d{4}$/,) !== null, true,);
      // UTC offset should be +0000
      assertEquals(result.endsWith("+0000",), true,);
    });

    it("differs from local timezone result", () => {
      const t = TjTime.fromString("2026-01-15-14:30:00",);
      const localResult = t.to_s();
      const utcResult = t.to_s(undefined, "UTC",);
      // Results should differ (unless local timezone is UTC)
      // At minimum, the timezone offset should differ
      assertEquals(localResult.endsWith("+0000",), false,);
      assertEquals(utcResult.endsWith("+0000",), true,);
    });
  });

  describe("custom format", () => {
    it("uses provided format string", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      const result = t.to_s("%Y/%m/%d %H:%M",);
      assertEquals(result, "2026/01/15 14:30",);
    });

    it("uses provided format with custom timezone", () => {
      const t = TjTime.fromString("2026-01-15-14:30:45",);
      const result = t.to_s("%Y-%m-%d %H:%M %z", "UTC",);
      assertEquals(result.endsWith("+0000",), true,);
    });
  });
});
