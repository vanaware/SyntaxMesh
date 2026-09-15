import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import { ScoreboardInterval } from "../../src/time/scoreboard-interval.ts";
import { TjTime } from "../../src/time/tj-time.ts";

describe("ScoreboardInterval", () => {
  describe("constructor", () => {
    it("creates from single ScoreboardInterval copy", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const end = 5;
      const original = new ScoreboardInterval(sbStart, slotDuration, start, end);
      const copy = new ScoreboardInterval(original);
      assertEquals(copy.sbStart, sbStart);
      assertEquals(copy.slotDuration, slotDuration);
      assertEquals(copy.start, start);
      assertEquals(copy.end, end);
    });

    it("creates from sbStart, slotDuration, and single index", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const iv = new ScoreboardInterval(sbStart, slotDuration, start);
      assertEquals(iv.sbStart, sbStart);
      assertEquals(iv.slotDuration, slotDuration);
      assertEquals(iv.start, start);
      assertEquals(iv.end, start);
    });

    it("creates from sbStart, slotDuration, start, and end", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const end = 5;
      const iv = new ScoreboardInterval(sbStart, slotDuration, start, end);
      assertEquals(iv.sbStart, sbStart);
      assertEquals(iv.slotDuration, slotDuration);
      assertEquals(iv.start, start);
      assertEquals(iv.end, end);
    });

    it("throws on invalid single argument", () => {
      assertThrows(() => new ScoreboardInterval("not a scoreboard interval" as unknown as ScoreboardInterval), Error, "Illegal argument 1");
    });

    it("throws on invalid sbStart type", () => {
      assertThrows(() => new ScoreboardInterval("not a date", 60, 2), Error, "sbStart must be a date");
    });

    it("throws on invalid slotDuration type", () => {
      const sbStart = TjTime.fromSeconds(100);
      assertThrows(() => new ScoreboardInterval(sbStart, "not an integer", 2), Error, "slotDuration must be an integer");
    });

    it("throws on invalid start type (non-integer, non-TjTime)", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      assertThrows(() => new ScoreboardInterval(sbStart, slotDuration, "not an integer or date"), Error, "start must be an integer or TjTime");
    });

    it("throws on invalid end type (non-integer, non-TjTime)", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      assertThrows(() => new ScoreboardInterval(sbStart, slotDuration, 2, "not an integer or date"), Error, "end must be an integer or TjTime");
    });

    it("throws on too many arguments", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      assertThrows(() => new ScoreboardInterval(sbStart, slotDuration, 2, 5, 10), Error, "Too many arguments");
    });
  });

  describe("startDate and endDate", () => {
    it("returns correct startDate", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const iv = new ScoreboardInterval(sbStart, slotDuration, start);
      const expected = sbStart.addSeconds(start * slotDuration);
      assertEquals(iv.startDate(), expected);
    });

    it("returns correct endDate", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const end = 5;
      const iv = new ScoreboardInterval(sbStart, slotDuration, start, end);
      const expected = sbStart.addSeconds(end * slotDuration);
      assertEquals(iv.endDate(), expected);
    });
  });

  describe("duration", () => {
    it("returns correct duration", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const end = 5;
      const iv = new ScoreboardInterval(sbStart, slotDuration, start, end);
      const expected = (end - start) * slotDuration;
      assertEquals(iv.duration(), expected);
    });

    it("returns 0 for single slot", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const iv = new ScoreboardInterval(sbStart, slotDuration, start);
      assertEquals(iv.duration(), 0);
    });
  });

  describe("setters", () => {
    it("sets start with number", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const end = 5;
      const iv = new ScoreboardInterval(sbStart, slotDuration, start, end);
      iv.start = 3;
      assertEquals(iv.start, 3);
    });

    it("sets start with TjTime", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const end = 5;
      const iv = new ScoreboardInterval(sbStart, slotDuration, start, end);
      const newStartTime = TjTime.fromSeconds(220); // sbStart + 2 * slotDuration
      iv.start = newStartTime;
      assertEquals(iv.start, 2); // (220 - 100) / 60 = 2
    });

    it("sets end with number", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const end = 5;
      const iv = new ScoreboardInterval(sbStart, slotDuration, start, end);
      iv.end = 6;
      assertEquals(iv.end, 6);
    });

    it("sets end with TjTime", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const end = 5;
      const iv = new ScoreboardInterval(sbStart, slotDuration, start, end);
      const newEndTime = TjTime.fromSeconds(460); // sbStart + 6 * slotDuration
      iv.end = newEndTime;
      assertEquals(iv.end, 6); // (460 - 100) / 60 = 6
    });
  });

  describe("dateToIndex and indexToDate", () => {
    it("converts date to index correctly", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const iv = new ScoreboardInterval(sbStart, slotDuration, start);
      const testDate = sbStart.addSeconds(120); // sbStart + 2 * slotDuration
      assertEquals(iv.dateToIndex(testDate), 2);
    });

    it("converts index to date correctly", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const iv = new ScoreboardInterval(sbStart, slotDuration, start);
      const expected = sbStart.addSeconds(2 * slotDuration);
      assertEquals(iv.indexToDate(2), expected);
    });
  });

  describe("to_s", () => {
    it("formats as startDate - endDate", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const end = 5;
      const iv = new ScoreboardInterval(sbStart, slotDuration, start, end);
      const expectedStart = sbStart.addSeconds(start * slotDuration);
      const expectedEnd = sbStart.addSeconds(end * slotDuration);
      assertEquals(iv.to_s(), `${expectedStart.to_s()} - ${expectedEnd.to_s()}`);
    });

    it("formats single slot correctly", () => {
      const sbStart = TjTime.fromSeconds(100);
      const slotDuration = 60;
      const start = 2;
      const iv = new ScoreboardInterval(sbStart, slotDuration, start);
      const expected = sbStart.addSeconds(start * slotDuration);
      assertEquals(iv.to_s(), `${expected.to_s()} - ${expected.to_s()}`);
    });
  });
});