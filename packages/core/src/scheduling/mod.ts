export * from "./data-cache.ts";
export * from "./limits.ts";
export * from "./shift-assignments.ts";
export * from "./task-dependency.ts";
export * from "./allocation.ts";
export * from "./booking.ts";

/**
 * Duration specification types for tasks.
 *
 * They correspond to the Ruby duration types:
 * - :effortTask   → Effort
 * - :lengthTask   → Length
 * - :durationTask → Duration
 * - :startEndTask → StartEnd
 */
export enum DurationType {
  Effort = 0,
  Length = 1,
  Duration = 2,
  StartEnd = 3,
}
