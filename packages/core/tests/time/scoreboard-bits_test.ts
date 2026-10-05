import { describe, it } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import { LEAVE_TYPES, BIT_ASSIGNED, BIT_OFF_WORK, LEAVE_MASK, LEAVE_SHIFT, BIT_OVERRIDE, packLeaveType, unpackLeaveType, isAssigned, isWorkingTime, isTimeOff, isLeave, isLeaveType, hasOverride, packWorkTime } from "../../src/time/scoreboard-bits.ts";

describe("scoreboard-bits", () => {
  describe("LEAVE_TYPES", () => {
    it("contém 7 tipos", () => {
      assertEquals(Object.keys(LEAVE_TYPES).length, 7);
    });

    it("project = 0", () => {
      assertEquals(LEAVE_TYPES.project, 0);
    });

    it("annual = 1", () => {
      assertEquals(LEAVE_TYPES.annual, 1);
    });

    it("special = 2", () => {
      assertEquals(LEAVE_TYPES.special, 2);
    });

    it("sick = 3", () => {
      assertEquals(LEAVE_TYPES.sick, 3);
    });

    it("unpaid = 4", () => {
      assertEquals(LEAVE_TYPES.unpaid, 4);
    });

    it("holiday = 5", () => {
      assertEquals(LEAVE_TYPES.holiday, 5);
    });

    it("unemployed = 6", () => {
      assertEquals(LEAVE_TYPES.unemployed, 6);
    });
  });

  describe("LEAVE_MASK", () => {
    it("é 0x3C", () => {
      assertEquals(LEAVE_MASK, 0x3C);
    });
  });

  describe("LEAVE_SHIFT", () => {
    it("é 2", () => {
      assertEquals(LEAVE_SHIFT, 2);
    });
  });

  describe("BIT_ASSIGNED", () => {
    it("é 1", () => {
      assertEquals(BIT_ASSIGNED, 1);
    });
  });

  describe("BIT_OFF_WORK", () => {
    it("é 2", () => {
      assertEquals(BIT_OFF_WORK, 2);
    });
  });

  describe("BIT_OVERRIDE", () => {
    it("é 256", () => {
      assertEquals(BIT_OVERRIDE, 256);
    });
  });

  describe("packLeaveType", () => {
    it("packLeaveType(2) = 8", () => {
      assertEquals(packLeaveType(2), 8);
    });

    it("packLeaveType(5) = 20", () => {
      assertEquals(packLeaveType(5), 20);
    });
  });

  describe("unpackLeaveType", () => {
    it("unpackLeaveType(8) = 2", () => {
      assertEquals(unpackLeaveType(8), 2);
    });

    it("unpackLeaveType(20) = 5", () => {
      assertEquals(unpackLeaveType(20), 5);
    });

    it("unpackLeaveType(null) = 0", () => {
      assertEquals(unpackLeaveType(null), 0);
    });

    it("unpackLeaveType(undefined) = 0", () => {
      assertEquals(unpackLeaveType(undefined), 0);
    });
  });

  describe("isAssigned", () => {
    it("isAssigned(1) = true", () => {
      assertEquals(isAssigned(1), true);
    });

    it("isAssigned(0) = false", () => {
      assertEquals(isAssigned(0), false);
    });

    it("isAssigned(null) = false", () => {
      assertEquals(isAssigned(null), false);
    });

    it("isAssigned(undefined) = false", () => {
      assertEquals(isAssigned(undefined), false);
    });
  });

  describe("isWorkingTime / isTimeOff", () => {
    it("isWorkingTime(0) = true (bit 1 não set)", () => {
      assertEquals(isWorkingTime(0), true);
    });

    it("isWorkingTime(2) = false (bit 1 set)", () => {
      assertEquals(isWorkingTime(2), false);
    });

    it("isTimeOff(0) = false (bit 1 não set)", () => {
      assertEquals(isTimeOff(0), false);
    });

    it("isTimeOff(2) = true (bit 1 set)", () => {
      assertEquals(isTimeOff(2), true);
    });

    it("isWorkingTime(null) = false", () => {
      assertEquals(isWorkingTime(null), false);
    });

    it("isTimeOff(null) = false", () => {
      assertEquals(isTimeOff(null), false);
    });
  });

  describe("isOnLeave", () => {
    it("isOnLeave(0) = false (bits 2-5 zero)", () => {
      assertEquals(isLeave(0), false);
    });

    it("isOnLeave(8) = true (bits 2-5 = 2)", () => {
      assertEquals(isLeave(8), true);
    });

    it("isOnLeave(20) = true (bits 2-5 = 5)", () => {
      assertEquals(isLeave(20), true);
    });

    it("isOnLeave(null) = false", () => {
      assertEquals(isLeave(null), false);
    });
  });

  describe("isLeaveType", () => {
    it("isLeaveType(8, 2) = true", () => {
      assertEquals(isLeaveType(8, 2), true);
    });

    it("isLeaveType(8, 5) = false", () => {
      assertEquals(isLeaveType(8, 5), false);
    });

    it("isLeaveType(20, 5) = true", () => {
      assertEquals(isLeaveType(20, 5), true);
    });

    it("isLeaveType(null, 5) = false", () => {
      assertEquals(isLeaveType(null, 5), false);
    });
  });

  describe("hasOverride", () => {
    it("hasOverride(256) = true", () => {
      assertEquals(hasOverride(256), true);
    });

    it("hasOverride(0) = false", () => {
      assertEquals(hasOverride(0), false);
    });

    it("hasOverride(null) = false", () => {
      assertEquals(hasOverride(null), false);
    });
  });

  describe("packWorkTime", () => {
    it("packWorkTime(true) = 1 (apenas BIT_ASSIGNED)", () => {
      assertEquals(packWorkTime(true), 1);
    });

    it("packWorkTime(false) = 3 (BIT_ASSIGNED + BIT_OFF_WORK)", () => {
      assertEquals(packWorkTime(false), 3);
    });

    it("packWorkTime(true, LEAVE_TYPES.holiday) = 21 (1 + 20)", () => {
      assertEquals(packWorkTime(true, LEAVE_TYPES.holiday), 21);
    });

    it("packWorkTime(true, undefined, true) = 257 (1 + 256)", () => {
      assertEquals(packWorkTime(true, undefined, true), 257);
    });

    it("packWorkTime(false, LEAVE_TYPES.annual, true) = 263 (3 + 4 + 256)", () => {
      assertEquals(packWorkTime(false, LEAVE_TYPES.annual, true), 263);
    });
  });
});