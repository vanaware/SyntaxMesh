import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import {
  parseDuration,
  toHours,
  toDays,
  formatDuration,
  validateDuration,
  type Duration,
} from "../../src/time/duration.ts";

describe("Duration", () => {
  describe("parseDuration", () => {
    it("should parse hours correctly", () => {
      const result = parseDuration("8h");
      assertEquals(result, { value: 8, unit: "hours" });
    });

    it("should parse days correctly", () => {
      const result = parseDuration("2d");
      assertEquals(result, { value: 2, unit: "days" });
    });

    it("should parse weeks correctly", () => {
      const result = parseDuration("1w");
      assertEquals(result, { value: 1, unit: "weeks" });
    });

    it("should parse minutes correctly", () => {
      const result = parseDuration("30m");
      assertEquals(result, { value: 30, unit: "minutes" });
    });

    it("should throw error for invalid format", () => {
      assertThrows(
        () => parseDuration("invalid"),
        Error,
        "Formato de duração inválido",
      );
    });

    it("should throw error for unsupported unit", () => {
      assertThrows(
        () => parseDuration("1y"),
        Error,
        "Formato de duração inválido: 1y. Use formato como \"8h\", \"2d\", \"1w\"",
      );
    });
  });

  describe("toHours", () => {
    it("should convert minutes to hours", () => {
      const duration: Duration = { value: 60, unit: "minutes" };
      assertEquals(toHours(duration), 1);
    });

    it("should convert hours to hours", () => {
      const duration: Duration = { value: 8, unit: "hours" };
      assertEquals(toHours(duration), 8);
    });

    it("should convert days to hours", () => {
      const duration: Duration = { value: 1, unit: "days" };
      assertEquals(toHours(duration), 8);
    });

    it("should convert weeks to hours", () => {
      const duration: Duration = { value: 1, unit: "weeks" };
      assertEquals(toHours(duration), 40);
    });
  });

  describe("toDays", () => {
    it("should convert minutes to days", () => {
      const duration: Duration = { value: 480, unit: "minutes" };
      assertEquals(toDays(duration), 1);
    });

    it("should convert hours to days", () => {
      const duration: Duration = { value: 8, unit: "hours" };
      assertEquals(toDays(duration), 1);
    });

    it("should convert days to days", () => {
      const duration: Duration = { value: 2, unit: "days" };
      assertEquals(toDays(duration), 2);
    });

    it("should convert weeks to days", () => {
      const duration: Duration = { value: 1, unit: "weeks" };
      assertEquals(toDays(duration), 5);
    });
  });

  describe("formatDuration", () => {
    it("should format hours correctly", () => {
      const duration: Duration = { value: 8, unit: "hours" };
      assertEquals(formatDuration(duration), "8h");
    });

    it("should format days correctly", () => {
      const duration: Duration = { value: 2, unit: "days" };
      assertEquals(formatDuration(duration), "2d");
    });

    it("should format weeks correctly", () => {
      const duration: Duration = { value: 1, unit: "weeks" };
      assertEquals(formatDuration(duration), "1w");
    });

    it("should format minutes correctly", () => {
      const duration: Duration = { value: 30, unit: "minutes" };
      assertEquals(formatDuration(duration), "30min");
    });
  });

  describe("validateDuration", () => {
    it("should validate positive duration", () => {
      const duration: Duration = { value: 1, unit: "hours" };
      assertEquals(validateDuration(duration), true);
    });

    it("should reject zero duration", () => {
      const duration: Duration = { value: 0, unit: "hours" };
      assertEquals(validateDuration(duration), false);
    });

    it("should reject negative duration", () => {
      const duration: Duration = { value: -1, unit: "hours" };
      assertEquals(validateDuration(duration), false);
    });
  });
});