/**
 * `ProjectTiming` — timing helpers the time sheets use on top of
 * `ProjectLike`.
 *
 * `Resource.project` is typed as `ProjectLike` (the minimum the entities need in
 * the constructor). Timesheet calculations also need `dailyWorkingHours`,
 * `weeklyWorkingDays`, `convertToDailyLoad` and `dateToIdx`, which only exist on
 * `Project`. The cast lives in a single place instead of being spread around —
 * the same pattern as `projExt()` in `task-scenario.ts`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Project.rb
 */
import type { TjTime, } from "../time/tj-time.ts";

/**
 * Subset of `Project` used by timesheet calculations.
 */
export interface ProjectTiming {
  /**
   * Reads a project attribute.
   *
   * @param name Attribute name.
   * @returns The attribute value, or `undefined` when unset.
   */
  get(name: string,): unknown;

  /**
   * Converts a date into its scoreboard slot index.
   *
   * @param date Date to convert.
   * @param forceIntoProject When `true`, clamps the result to the project range.
   * @returns The slot index.
   */
  dateToIdx(date: TjTime, forceIntoProject?: boolean,): number;

  /**
   * Working hours of a standard working day.
   *
   * @returns The number of working hours per day.
   */
  dailyWorkingHours(): number;

  /**
   * Number of working days in a standard week.
   *
   * @returns The number of working days per week.
   */
  weeklyWorkingDays(): number;

  /**
   * Converts a duration in seconds into a daily load.
   *
   * @param seconds Duration in seconds.
   * @returns The equivalent daily load.
   */
  convertToDailyLoad(seconds: number,): number;
}
