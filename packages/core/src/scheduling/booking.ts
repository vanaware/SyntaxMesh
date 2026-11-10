import { Resource, } from "../model/resource.ts";
import { Task, } from "../model/task.ts";
import { type SourceFileInfo, } from "../model/property-tree-node.ts";
import { TimeInterval, } from "../time/time-interval.ts";

/**
 * Type of the `overtime` attribute of a `Booking`.
 *
 * Mirrors Ruby's `Booking#overtime`, an integer (default 0).
 */
export type Overtime = number;

/**
 * Type of the `sloppy` attribute of a `Booking`.
 *
 * Mirrors Ruby's `Booking#sloppy`, an integer (default 0).
 */
export type Sloppy = number;

/**
 * Allocation of a resource to a task over one or more time intervals.
 *
 * Each `Booking` pairs a resource with a task and stores the intervals during
 * which the allocation happens. The `overtime` and `sloppy` attributes control,
 * respectively, whether the booked effort counts as overtime and whether the
 * allocation may be shifted.
 *
 * Ruby source: `docs/taskjuggler/lib/taskjuggler/Booking.rb`
 */
export class Booking {
  /** Resource that is allocated by this booking. */
  readonly resource: Resource;
  /** Task the resource is allocated to. */
  readonly task: Task;
  /** Intervals covered by the allocation. */
  readonly intervals: TimeInterval[];
  /** Source location of the booking in the project file, when known. */
  sourceFileInfo: SourceFileInfo | null;
  /** Overtime flag of the allocation (0 or 1). */
  overtime: Overtime;
  /** Sloppy flag of the allocation, allowing the block to be shifted. */
  sloppy: Sloppy;

  /**
   * Creates a booking.
   *
   * @param resource Resource that is allocated.
   * @param task Task the resource is allocated to.
   * @param intervals Intervals covered by the allocation.
   */
  constructor(
    resource: Resource,
    task: Task,
    intervals: TimeInterval[],
  ) {
    this.resource = resource;
    this.task = task;
    this.intervals = intervals;
    this.sourceFileInfo = null;
    this.overtime = 0;
    this.sloppy = 0;
  }

  /**
   * Renders the allocation as text.
   *
   * Example: `r1 2024-01-01 - 2024-01-02, 2024-01-03 - 2024-01-04`
   *
   * @returns The resource full id followed by its intervals.
   */
  to_s(): string {
    let out = `${this.resource.fullId} `;
    let first = true;
    for (const iv of this.intervals) {
      if (!first) {
        out += ", ";
      }
      first = false;
      out += iv.to_s();
    }
    return out;
  }

  /**
   * Renders the allocation in TJP (TaskJuggler Project) format.
   *
   * @param taskMode When `true` the task id is used; otherwise the resource id.
   * @returns One TJP allocation block.
   */
  to_tjp(taskMode: boolean,): string {
    let out = taskMode ? `${this.task.fullId} ` : `${this.resource.fullId} `;
    let first = true;
    for (const iv of this.intervals) {
      if (!first) {
        out += ",\n";
      }
      first = false;
      out += `${iv.start} + ${iv.duration() / 3600}h`;
    }
    out += " { overtime 2 }";
    return out;
  }
}
