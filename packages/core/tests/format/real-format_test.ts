import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { RealFormat, } from "../../src/format/real-format.ts";
import { compat, } from "../../src/compat.ts";

describe("RealFormat", () => {
  describe("constructor", () => {
    it("creates from 5-arg array", () => {
      const rf = new RealFormat(["-", "", ",", ".", 2,],);
      assertEquals(rf.signPrefix, "-",);
      assertEquals(rf.signSuffix, "",);
      assertEquals(rf.thousandsSeparator, ",",);
      assertEquals(rf.fractionSeparator, ".",);
      assertEquals(rf.fractionDigits, 2,);
    });

    it("throws on wrong arg count", () => {
      assertThrows(
        () =>
          new RealFormat(
            ["-", "", ",",] as unknown as [
              string,
              string,
              string,
              string,
              number,
            ],
          ),
        Error,
        "Bad number of parameters 3",
      );
    });

    it("throws on empty array", () => {
      assertThrows(
        () =>
          new RealFormat(
            [] as unknown as [string, string, string, string, number,],
          ),
        Error,
        "Bad number of parameters 0",
      );
    });
  });

  describe("format(n)", () => {
    it("formats positive number with fraction digits", () => {
      const rf = new RealFormat(["-", "", ",", ".", 2,],);
      assertEquals(rf.format(1234.56,), "1,234.56",);
    });

    it("formats with padding when int part is short", () => {
      const rf = new RealFormat(["-", "", ",", ".", 2,],);
      // 0.5 * 100 = 50, length 2 <= 2, pad to "050", intPart = "0", fracPart = ".50"
      assertEquals(rf.format(0.5,), "0.50",);
    });

    it("formats large number with rounding", () => {
      const rf = new RealFormat(["-", "", ",", ".", 1,],);
      assertEquals(rf.format(1234.56,), "1,234.6",);
    });

    it("formats zero", () => {
      const rf = new RealFormat(["-", "", ",", ".", 2,],);
      assertEquals(rf.format(0,), "0.00",);
    });
  });

  describe("thousands separator", () => {
    it("inserts separator for thousands", () => {
      const rf = new RealFormat(["-", "", ".", ".", 0,],);
      assertEquals(rf.format(1234,), "1.234",);
    });

    it("no separator when thousandsSeparator is empty", () => {
      const rf = new RealFormat(["-", "", "", ".", 2,],);
      assertEquals(rf.format(1234.56,), "1234.56",);
    });

    it("handles millions", () => {
      const rf = new RealFormat(["-", "", ".", ".", 0,],);
      assertEquals(rf.format(1234567,), "1.234.567",);
    });

    it("does not add separator at start", () => {
      const rf = new RealFormat(["-", "", ".", ".", 0,],);
      // 999 has 3 digits, i=3 but i < intPart.length is false (3 < 3 = false)
      assertEquals(rf.format(999,), "999",);
    });

    it("handles exact thousands boundary", () => {
      const rf = new RealFormat(["-", "", ".", ".", 0,],);
      assertEquals(rf.format(1000,), "1.000",);
    });
  });

  describe("fractionDigits = 0", () => {
    it("no fractional part when fractionDigits is 0", () => {
      const rf = new RealFormat(["-", "", ".", ".", 0,],);
      assertEquals(rf.format(1234.56,), "1.235",);
    });

    it("fractionDigits = 0 rounds correctly", () => {
      const rf = new RealFormat(["-", "", ".", ".", 0,],);
      assertEquals(rf.format(0.4,), "0",);
      assertEquals(rf.format(0.5,), "1",);
    });
  });

  describe("signPrefix (negatives)", () => {
    it("prepends signPrefix for negative numbers", () => {
      const rf = new RealFormat(["-", "", "", ".", 2,],);
      assertEquals(rf.format(-1234.56,), "-1234.56",);
    });

    it("no prefix for positive numbers", () => {
      const rf = new RealFormat(["-", "", "", ".", 2,],);
      assertEquals(rf.format(1234.56,), "1234.56",);
    });

    it("prefix with parentheses", () => {
      const rf = new RealFormat(["(", ")", "", ".", 2,],);
      assertEquals(rf.format(-100,), "(100.00)",);
    });
  });

  describe("signSuffix (negatives)", () => {
    it("appends signSuffix for negative numbers", () => {
      const rf = new RealFormat(["", "-", "", ".", 2,],);
      assertEquals(rf.format(-1234.56,), "1234.56-",);
    });

    it("no suffix for positive numbers", () => {
      const rf = new RealFormat(["", "-", "", ".", 2,],);
      assertEquals(rf.format(1234.56,), "1234.56",);
    });

    it("suffix with closing paren", () => {
      const rf = new RealFormat(["(", ")", "", ".", 2,],);
      assertEquals(rf.format(-100,), "(100.00)",);
    });
  });

  describe("copy constructor and to_s", () => {
    it("copy constructor creates independent copy", () => {
      const original = new RealFormat(["-", "", "", ",", 2,],);
      const copy = new RealFormat(original,);
      assertEquals(copy.signPrefix, "-",);
      assertEquals(copy.fractionDigits, 2,);
      assertEquals(copy.format(1234.56,), "1234,56",);
    });

    it("to_s returns formatted string", () => {
      const rf = new RealFormat(["-", "", ",", ".", 2,],);
      assertEquals(rf.to_s(), '"-" "" "," "." "2"',);
    });
  });

  describe("round() half-up", () => {
    it("rounds 2.5 up to 3", () => {
      const rf = new RealFormat(["-", "", "", ".", 0,],);
      assertEquals(rf.format(2.5,), "3",);
    });

    it("rounds 1.5 up to 2", () => {
      const rf = new RealFormat(["-", "", "", ".", 0,],);
      assertEquals(rf.format(1.5,), "2",);
    });

    it("rounds 0.5 up to 1", () => {
      const rf = new RealFormat(["-", "", "", ".", 0,],);
      assertEquals(rf.format(0.5,), "1",);
    });

    it("rounds -12.5 to -13 with fractionDigits=0 (compat mode)", () => {
      const rf = new RealFormat(["-", "", "", ".", 0,],);
      assertEquals(rf.format(-12.5,), "-13",);
    });

    it("rounds -12.5 to -12 with fractionDigits=0 (fix mode)", () => {
      const rf = new RealFormat(["-", "", "", ".", 0,],);
      // Temporarily set compat.keepRubyBugs=false to test fix mode
      const original = compat.keepRubyBugs;
      compat.keepRubyBugs = false;
      try {
        assertEquals(rf.format(-12.5,), "-12",);
      } finally {
        compat.keepRubyBugs = original;
      }
    });
  });
});
