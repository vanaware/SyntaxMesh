import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import {
  parseEffort,
  toTotalHours,
  durationToEffort,
  formatEffort,
  validateEffort,
  type Effort,
} from "../../src/time/effort.ts";
import { parseDuration } from "../../src/time/duration.ts";

describe("Effort", () => {
  describe("parseEffort", () => {
    it("should parse hours correctly", () => {
      const result = parseEffort("8h");
      assertEquals(result, { value: 8, unit: "hours", resourceCount: 1 });
    });

    it("should parse days correctly", () => {
      const result = parseEffort("2d");
      assertEquals(result, { value: 2, unit: "days", resourceCount: 1 });
    });

    it("should parse weeks correctly", () => {
      const result = parseEffort("1w");
      assertEquals(result, { value: 1, unit: "weeks", resourceCount: 1 });
    });

    it("should throw error for invalid format", () => {
      assertThrows(
        () => parseEffort("invalid"),
        Error,
        "Formato de esforço inválido",
      );
    });

    it("should throw error for unsupported unit", () => {
      assertThrows(
        () => parseEffort("1m"),
        Error,
        "Formato de esforço inválido: 1m. Use formato como \"8h\", \"2d\", \"1w\"",
      );
    });
  });

  describe("toTotalHours", () => {
    it("should calculate hours for single resource", () => {
      const effort: Effort = { value: 8, unit: "hours", resourceCount: 1 };
      assertEquals(toTotalHours(effort), 8);
    });

    it("should calculate hours for multiple resources", () => {
      const effort: Effort = { value: 8, unit: "hours", resourceCount: 2 };
      assertEquals(toTotalHours(effort), 16);
    });

    it("should convert days to hours", () => {
      const effort: Effort = { value: 1, unit: "days", resourceCount: 1 };
      assertEquals(toTotalHours(effort), 8);
    });

    it("should convert weeks to hours", () => {
      const effort: Effort = { value: 1, unit: "weeks", resourceCount: 1 };
      assertEquals(toTotalHours(effort), 40);
    });
  });

  describe("durationToEffort", () => {
    it("should convert duration to effort with default resource count", () => {
      const duration = parseDuration("8h");
      const effort = durationToEffort(duration);
      assertEquals(effort, { value: 8, unit: "hours", resourceCount: 1 });
    });

    it("should convert duration to effort with custom resource count", () => {
      const duration = parseDuration("8h");
      const effort = durationToEffort(duration, 2);
      assertEquals(effort, { value: 8, unit: "hours", resourceCount: 2 });
    });

    it("should convert days duration to hours effort", () => {
      const duration = parseDuration("1d");
      const effort = durationToEffort(duration);
      assertEquals(effort, { value: 8, unit: "hours", resourceCount: 1 });
    });
  });

  describe("formatEffort", () => {
    it("should format hours effort correctly", () => {
      const effort: Effort = { value: 8, unit: "hours", resourceCount: 1 };
      assertEquals(formatEffort(effort), "8h × 1 recurso(s)");
    });

    it("should format days effort correctly", () => {
      const effort: Effort = { value: 2, unit: "days", resourceCount: 2 };
      assertEquals(formatEffort(effort), "2d × 2 recurso(s)");
    });

    it("should format weeks effort correctly", () => {
      const effort: Effort = { value: 1, unit: "weeks", resourceCount: 3 };
      assertEquals(formatEffort(effort), "1w × 3 recurso(s)");
    });
  });

  describe("validateEffort", () => {
    it("should validate valid effort", () => {
      const effort: Effort = { value: 1, unit: "hours", resourceCount: 1 };
      assertEquals(validateEffort(effort), true);
    });

    it("should reject zero value", () => {
      const effort: Effort = { value: 0, unit: "hours", resourceCount: 1 };
      assertEquals(validateEffort(effort), false);
    });

    it("should reject negative value", () => {
      const effort: Effort = { value: -1, unit: "hours", resourceCount: 1 };
      assertEquals(validateEffort(effort), false);
    });

    it("should reject zero resource count", () => {
      const effort: Effort = { value: 1, unit: "hours", resourceCount: 0 };
      assertEquals(validateEffort(effort), false);
    });

    it("should reject negative resource count", () => {
      const effort: Effort = { value: 1, unit: "hours", resourceCount: -1 };
      assertEquals(validateEffort(effort), false);
    });
  });
});