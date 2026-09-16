import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import { Interval } from "../../src/time/interval.ts";
import { IntervalList } from "../../src/time/interval-list.ts";
import { TjTime } from "../../src/time/tj-time.ts";

describe("IntervalList", () => {
  describe("extends Array with Symbol.species", () => {
    it("is an instance of Array", () => {
      const list = new IntervalList<Interval<number>>();
      assertEquals(list instanceof Array, true);
    });

    it("Symbol.species is Array", () => {
      assertEquals(IntervalList[Symbol.species], Array);
    });
  });

  describe("append", () => {
    it("appends an interval without validation", () => {
      const list = new IntervalList<Interval<number>>();
      list.append(new Interval(0, 1));
      list.append(new Interval(1, 2));
      assertEquals(list.length, 2);
      assertEquals(list[0]!.start, 0);
      assertEquals(list[1]!.end, 2);
    });
  });

  describe("push", () => {
    it("throws when intervals overlap", () => {
      const list = new IntervalList<Interval<number>>();
      list.push(new Interval(0, 2));
      assertThrows(() => list.push(new Interval(1, 3)));
    });

    it("merges intervals that share a boundary", () => {
      const list = new IntervalList<Interval<number>>();
      list.push(new Interval(0, 1));
      list.push(new Interval(1, 2));
      assertEquals(list.length, 1);
      assertEquals(list[0]!.start, 0);
      assertEquals(list[0]!.end, 2);
    });

    it("appends non-overlapping intervals", () => {
      const list = new IntervalList<Interval<number>>();
      list.push(new Interval(0, 1));
      list.push(new Interval(2, 3));
      assertEquals(list.length, 2);
    });

    it("handles empty list", () => {
      const list = new IntervalList<Interval<number>>();
      list.push(new Interval(0, 1));
      assertEquals(list.length, 1);
    });
  });

  describe("intersect", () => {
    it("returns empty IntervalList when no overlap", () => {
      const a = new IntervalList<Interval<number>>();
      a.push(new Interval(0, 1));
      const b = new IntervalList<Interval<number>>();
      b.push(new Interval(2, 3));
      const res = a.intersect(b);
      assertEquals(res.length, 0);
      assertEquals(res instanceof IntervalList, true);
    });

    it("returns identical intervals when fully overlapping", () => {
      const a = new IntervalList<Interval<number>>();
      a.push(new Interval(0, 5));
      const b = new IntervalList<Interval<number>>();
      b.push(new Interval(0, 5));
      const res = a.intersect(b);
      assertEquals(res.length, 1);
      assertEquals(res[0]!.start, 0);
      assertEquals(res[0]!.end, 5);
    });

    it("returns partial overlap", () => {
      const a = new IntervalList<Interval<number>>();
      a.push(new Interval(0, 3));
      const b = new IntervalList<Interval<number>>();
      b.push(new Interval(2, 5));
      const res = a.intersect(b);
      assertEquals(res.length, 1);
      assertEquals(res[0]!.start, 2);
      assertEquals(res[0]!.end, 3);
    });

    it("handles multiple intervals in both lists", () => {
      const a = new IntervalList<Interval<number>>();
      a.push(new Interval(0, 2));
      a.push(new Interval(4, 6));
      const b = new IntervalList<Interval<number>>();
      b.push(new Interval(1, 5));
      const res = a.intersect(b);
      assertEquals(res.length, 2);
      assertEquals(res[0]!.start, 1);
      assertEquals(res[0]!.end, 2);
      assertEquals(res[1]!.start, 4);
      assertEquals(res[1]!.end, 5);
    });

    it("handles intervals with equal starts", () => {
      const a = new IntervalList<Interval<number>>();
      a.push(new Interval(0, 3));
      const b = new IntervalList<Interval<number>>();
      b.push(new Interval(0, 5));
      const res = a.intersect(b);
      assertEquals(res.length, 1);
      assertEquals(res[0]!.start, 0);
      assertEquals(res[0]!.end, 3);
    });

    it("works with TjTime", () => {
      const t1 = TjTime.fromString("2026-01-01-00:00:00");
      const t2 = TjTime.fromString("2026-01-01-02:00:00");
      const t3 = TjTime.fromString("2026-01-01-01:00:00");
      const t4 = TjTime.fromString("2026-01-01-03:00:00");
      const a = new IntervalList<Interval<TjTime>>();
      a.push(new Interval(t1, t2));
      const b = new IntervalList<Interval<TjTime>>();
      b.push(new Interval(t3, t4));
      const res = a.intersect(b);
      assertEquals(res.length, 1);
      assertEquals(res[0]!.start, t3);
      assertEquals(res[0]!.end, t2);
    });
  });

  describe("smoke test", () => {
    it("merges 100 ascending intervals into one", () => {
      const list = new IntervalList<Interval<number>>();
      for (let i = 0; i < 100; i++) {
        list.push(new Interval(i, i + 1));
      }
      assertEquals(list.length, 1);
      assertEquals(list[0]!.start, 0);
      assertEquals(list[0]!.end, 100);
    });
  });
});