import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { Interval, } from "../../src/time/interval.ts";

describe("Interval", () => {
  describe("constructor", () => {
    it("creates interval with valid start and end", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      assertEquals(iv.start, 1,);
      assertEquals(iv.end, 5,);
    });

    it("throws TjArgumentError when end < start", () => {
      assertThrows(() => new Interval(5, 1,), Error, "Invalid interval",);
    });
  });

  describe("contains", () => {
    it("contains value within interval", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      assertEquals(iv.contains(3,), true,);
    });

    it("does not contain value outside interval", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      assertEquals(iv.contains(6,), false,);
    });

    it("contains interval within interval", () => {
      const iv: Interval<number> = new Interval(1, 10,);
      const inner: Interval<number> = new Interval(3, 7,);
      assertEquals(iv.contains(inner,), true,);
    });

    it("throws TjArgumentError on class mismatch", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      assertThrows(
        () => iv.contains("string" as unknown as number,),
        Error,
        "Class mismatch",
      );
    });
  });

  describe("overlaps", () => {
    it("overlaps with overlapping interval", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      const other: Interval<number> = new Interval(3, 7,);
      assertEquals(iv.overlaps(other,), true,);
    });

    it("does not overlap with non-overlapping interval", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      const other: Interval<number> = new Interval(6, 10,);
      assertEquals(iv.overlaps(other,), false,);
    });

    it("overlaps with value inside interval", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      assertEquals(iv.overlaps(3,), true,);
    });

    it("does not overlap with value outside interval", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      assertEquals(iv.overlaps(6,), false,);
    });

    it("throws TjArgumentError on class mismatch", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      assertThrows(
        () => iv.overlaps("string" as unknown as number,),
        Error,
        "Class mismatch",
      );
    });
  });

  describe("intersection", () => {
    it("returns intersection of overlapping intervals", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      const other: Interval<number> = new Interval(3, 7,);
      const result = iv.intersection(other,);
      assert(result !== null,);
      assertEquals(result.start, 3,);
      assertEquals(result.end, 5,);
    });

    it("returns null for non-overlapping intervals", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      const other: Interval<number> = new Interval(6, 10,);
      assertEquals(iv.intersection(other,), null,);
    });

    it("returns null for adjacent intervals (start === end)", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      const other: Interval<number> = new Interval(5, 10,);
      assertEquals(iv.intersection(other,), null,);
    });

    it("returns identical interval for identical intervals", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      const result = iv.intersection(iv,);
      assert(result !== null,);
      assertEquals(result.start, 1,);
      assertEquals(result.end, 5,);
    });
  });

  describe("combine", () => {
    it("returns array with 1 element when iv.end === start", () => {
      const iv: Interval<number> = new Interval(3, 7,);
      const other: Interval<number> = new Interval(1, 3,);
      const result = iv.combine(other,);
      assertEquals(Array.isArray(result,), true,);
      assertEquals(result.length, 1,);
      assertEquals(result[0]!.start, 1,);
      assertEquals(result[0]!.end, 7,);
    });

    it("returns array with 1 element when end === iv.start", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      const other: Interval<number> = new Interval(5, 10,);
      const result = iv.combine(other,);
      assertEquals(Array.isArray(result,), true,);
      assertEquals(result.length, 1,);
      assertEquals(result[0]!.start, 1,);
      assertEquals(result[0]!.end, 10,);
    });

    it("returns array with this interval when no adjacency", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      const other: Interval<number> = new Interval(7, 10,);
      const result = iv.combine(other,);
      assertEquals(Array.isArray(result,), true,);
      assertEquals(result.length, 1,);
      assertEquals(result[0]!.start, 1,);
      assertEquals(result[0]!.end, 5,);
    });

    it("returns array with this interval when overlapping", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      const other: Interval<number> = new Interval(3, 7,);
      const result = iv.combine(other,);
      assertEquals(Array.isArray(result,), true,);
      assertEquals(result.length, 1,);
      assertEquals(result[0]!.start, 1,);
      assertEquals(result[0]!.end, 5,);
    });
  });

  describe("compareTo", () => {
    it("returns -1 when end < iv.start", () => {
      const iv: Interval<number> = new Interval(1, 3,);
      const other: Interval<number> = new Interval(5, 10,);
      assertEquals(iv.compareTo(other,), -1,);
    });

    it("returns 1 when iv.end < start", () => {
      const iv: Interval<number> = new Interval(5, 10,);
      const other: Interval<number> = new Interval(1, 3,);
      assertEquals(iv.compareTo(other,), 1,);
    });

    it("returns 0 when intervals overlap", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      const other: Interval<number> = new Interval(3, 7,);
      assertEquals(iv.compareTo(other,), 0,);
    });

    it("returns 0 for adjacent intervals (end === iv.start)", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      const other: Interval<number> = new Interval(5, 10,);
      assertEquals(iv.compareTo(other,), 0,);
    });
  });

  describe("equals", () => {
    it("returns true for same class and start/end", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      const other: Interval<number> = new Interval(1, 5,);
      assertEquals(iv.equals(other,), true,);
    });

    it("returns false for different start", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      const other: Interval<number> = new Interval(2, 5,);
      assertEquals(iv.equals(other,), false,);
    });

    it("returns false for different end", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      const other: Interval<number> = new Interval(1, 6,);
      assertEquals(iv.equals(other,), false,);
    });
  });

  describe("class mismatch check", () => {
    it("throws TjArgumentError when calling contains with non-Interval", () => {
      const iv: Interval<number> = new Interval(1, 5,);
      assertThrows(
        () => iv.contains("string" as unknown as number,),
        Error,
        "Class mismatch",
      );
    });
  });
});
