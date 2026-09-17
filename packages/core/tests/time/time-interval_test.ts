import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

describe("TimeInterval", () => {
  describe("constructor", () => {
    it("creates from single TjTime", () => {
      const t = TjTime.fromSeconds(100,);
      const iv = new TimeInterval(t,);
      assertEquals(iv.start, t,);
      assertEquals(iv.end, t,);
    });

    it("creates from TimeInterval copy", () => {
      const t = TjTime.fromSeconds(100,);
      const iv1 = new TimeInterval(t,);
      const iv2 = new TimeInterval(iv1,);
      assertEquals(iv2.start, t,);
      assertEquals(iv2.end, t,);
    });

    it("creates from two TjTime arguments", () => {
      const start = TjTime.fromSeconds(100,);
      const end = TjTime.fromSeconds(200,);
      const iv = new TimeInterval(start, end,);
      assertEquals(iv.start, start,);
      assertEquals(iv.end, end,);
    });

    it("throws on invalid single argument", () => {
      assertThrows(
        () => new TimeInterval("not a date" as unknown as TjTime,),
        Error,
        "Illegal argument 1",
      );
    });

    it("throws on invalid start type", () => {
      const end = TjTime.fromSeconds(200,);
      assertThrows(
        () => new TimeInterval("not a date" as unknown as TjTime, end,),
        Error,
        "Interval start must be a date",
      );
    });

    it("throws on invalid end type", () => {
      const start = TjTime.fromSeconds(100,);
      assertThrows(
        () => new TimeInterval(start, "not a date" as unknown as TjTime,),
        Error,
        "Interval end must be a date",
      );
    });

    it("throws on too many arguments", () => {
      const start = TjTime.fromSeconds(100,);
      const end = TjTime.fromSeconds(200,);
      assertThrows(
        () => new TimeInterval(start, end, TjTime.fromSeconds(300,),),
        Error,
        "Too many arguments",
      );
    });
  });

  describe("duration", () => {
    it("returns duration in seconds", () => {
      const start = TjTime.fromSeconds(100,);
      const end = TjTime.fromSeconds(250,);
      const iv = new TimeInterval(start, end,);
      assertEquals(iv.duration(), 150,);
    });

    it("returns 0 for same start and end", () => {
      const t = TjTime.fromSeconds(100,);
      const iv = new TimeInterval(t,);
      assertEquals(iv.duration(), 0,);
    });
  });

  describe("to_s", () => {
    it("formats as start - end", () => {
      const start = TjTime.fromSeconds(100,);
      const end = TjTime.fromSeconds(200,);
      const iv = new TimeInterval(start, end,);
      assertEquals(iv.to_s(), `${start.to_s()} - ${end.to_s()}`,);
    });
  });

  describe("setters", () => {
    it("sets start", () => {
      const start = TjTime.fromSeconds(100,);
      const end = TjTime.fromSeconds(200,);
      const iv = new TimeInterval(start, end,);
      const newStart = TjTime.fromSeconds(150,);
      iv.start = newStart;
      assertEquals(iv.start, newStart,);
    });

    it("sets end", () => {
      const start = TjTime.fromSeconds(100,);
      const end = TjTime.fromSeconds(200,);
      const iv = new TimeInterval(start, end,);
      const newEnd = TjTime.fromSeconds(250,);
      iv.end = newEnd;
      assertEquals(iv.end, newEnd,);
    });
  });

  describe("static fromSingle", () => {
    it("creates TimeInterval from single TjTime", () => {
      const t = TjTime.fromSeconds(100,);
      const iv = TimeInterval.fromSingle(t,);
      assertEquals(iv.start, t,);
      assertEquals(iv.end, t,);
    });
  });

  describe("static fromInterval", () => {
    it("creates TimeInterval from Interval<TjTime>", () => {
      const start = TjTime.fromSeconds(100,);
      const end = TjTime.fromSeconds(200,);
      const iv = new TimeInterval(start, end,);
      const ti = TimeInterval.fromInterval(iv,);
      assertEquals(ti.start, start,);
      assertEquals(ti.end, end,);
    });
  });
});
