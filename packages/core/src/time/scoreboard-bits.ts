/**
 * Bit encoding for numeric scoreboards in TaskJuggler.
 *
 * This module centralises the bit encoding conventions used by:
 * - Project.initScoreboards
 * - ResourceScenario.initScoreboard
 * - ShiftAssignments
 *
 * The encoding is a convention, not a class. `Scoreboard<T>` is generic; the
 * encoding only applies to numeric scoreboards (`number | null`).
 */

/**
 * Leave kinds — mapped to bits 2–5 (`LEAVE_SHIFT` to `LEAVE_SHIFT + 3`).
 * Order: project (0) is the lowest priority; holiday (5) is the most common.
 */
export const LEAVE_TYPES = {
  project: 0, // 0b00 << LEAVE_SHIFT = 0
  annual: 1, // 0b01 << LEAVE_SHIFT = 4
  special: 2, // 0b10 << LEAVE_SHIFT = 8
  sick: 3, // 0b11 << LEAVE_SHIFT = 12
  unpaid: 4, // 0b100 << LEAVE_SHIFT = 16
  holiday: 5, // 0b101 << LEAVE_SHIFT = 20
  unemployed: 6, // 0b110 << LEAVE_SHIFT = 24
} as const;

/**
 * Mask of the leave bits (bits 2–5).
 * 0b00111100 = 0x3C.
 */
export const LEAVE_MASK = 0x3C; // bits 2-5

/**
 * Shift of the leave bits (bits 2–5).
 * The leave kinds occupy bits 2, 3, 4 and 5.
 */
export const LEAVE_SHIFT = 2;

/**
 * Bit 0: assigned (a shift is assigned).
 */
export const BIT_ASSIGNED = 1 << 0; // 0b0001 = 1

/**
 * Bit 1: no working time (off duty).
 * When bit 1 = 0 → working time available (working hours).
 * When bit 1 = 1 → no working time (off duty).
 */
export const BIT_OFF_WORK = 1 << 1; // 0b0010 = 2

/**
 * Bit 8: global override (replaces the working hours).
 */
export const BIT_OVERRIDE = 1 << 8; // 0b100000000 = 256

/**
 * Encodes a leave kind into its scoreboard value.
 *
 * @param type One of the `LEAVE_TYPES` values.
 * @returns The value shifted to bits 2–5.
 */
export function packLeaveType(type: number,): number {
  return type << LEAVE_SHIFT;
}

/**
 * Decodes the leave kind of a scoreboard value.
 *
 * @param val Numeric scoreboard value (bits 2–5 hold the kind).
 * @returns The leave kind (0–6), or 0 when `val` is null or undefined.
 */
export function unpackLeaveType(val: number | null | undefined,): number {
  if (val == null) return 0;
  return (val & LEAVE_MASK) >>> LEAVE_SHIFT;
}

/**
 * Tells whether the value marks an assignment (bit 0 set).
 *
 * @param val Numeric scoreboard value.
 * @returns `true` when bit 0 is set.
 */
export function isAssigned(val: number | null | undefined,): boolean {
  if (val == null) return false;
  return (val & BIT_ASSIGNED) !== 0;
}

/**
 * Tells whether the value marks available working time (bit 1 clear).
 *
 * @param val Numeric scoreboard value.
 * @returns `true` when bit 1 is clear.
 */
export function isWorkingTime(val: number | null | undefined,): boolean {
  if (val == null) return false;
  return (val & BIT_OFF_WORK) === 0;
}

/**
 * Tells whether the value marks **no** working time (bit 1 set).
 *
 * @param val Numeric scoreboard value.
 * @returns `true` when bit 1 is set.
 */
export function isTimeOff(val: number | null | undefined,): boolean {
  if (val == null) return false;
  return (val & BIT_OFF_WORK) !== 0;
}

/**
 * Tells whether the value marks any leave (bits 2–5 not zero).
 *
 * @param val Numeric scoreboard value.
 * @returns `true` when a leave kind is encoded.
 */
export function isLeave(val: number | null | undefined,): boolean {
  if (val == null) return false;
  return (val & LEAVE_MASK) !== 0;
}

/**
 * Tells whether the value marks a leave of a specific kind.
 *
 * Named differently from `model/leave.ts#isLeaveType` (a predicate over the
 * **name** of the kind, e.g. `"annual"`) to avoid a collision at the package
 * top level: here the kind is the numeric scoreboard index (1–7).
 *
 * @param val Scoreboard value.
 * @param type One of the `LEAVE_TYPES` values.
 * @returns `true` when bits 2–5 hold the given kind.
 */
export function isScoreboardLeaveType(
  val: number | null | undefined,
  type: number,
): boolean {
  if (val == null) return false;
  return unpackLeaveType(val,) === type;
}

/**
 * Tells whether the value marks a global override (bit 8 set).
 *
 * @param val Numeric scoreboard value.
 * @returns `true` when bit 8 is set.
 */
export function hasOverride(val: number | null | undefined,): boolean {
  if (val == null) return false;
  return (val & BIT_OVERRIDE) !== 0;
}

/**
 * Builds a complete scoreboard value from its components.
 *
 * @param isWorking `true` when working time is available (bit 1 = 0).
 * @param leaveType Optional kind of leave, one of the `LEAVE_TYPES` values.
 * @param hasOverride `true` for a global override (bit 8 = 1).
 * @returns The integer value with the bits set from the arguments.
 */
export function packWorkTime(
  isWorking: boolean,
  leaveType?: number,
  hasOverride?: boolean,
): number {
  let val = 0;

  // Bit 0: assigned (this helper assumes an assignment always exists).
  val |= BIT_ASSIGNED;

  // Bit 1: off duty when not `isWorking`.
  if (!isWorking) {
    val |= BIT_OFF_WORK;
  }

  // Bits 2–5: leave kind.
  if (leaveType != null) {
    val |= packLeaveType(leaveType,);
  }

  // Bit 8: override.
  if (hasOverride) {
    val |= BIT_OVERRIDE;
  }

  return val;
}
