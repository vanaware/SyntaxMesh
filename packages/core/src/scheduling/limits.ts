import { TjArgumentError, } from "../attributes/errors.ts";
import { ScoreboardInterval, } from "../time/scoreboard-interval.ts";
import { Scoreboard, } from "../time/scoreboard.ts";
import { TjTime, } from "../time/tj-time.ts";
import { ProjectLike, } from "../model/project-like.ts";
import { Resource, } from "../model/resource.ts";

/**
 * A single limit (daily, weekly, monthly, ...) backed by a `Scoreboard<number>`
 * of counters.
 *
 * `Limit` is used by `TaskScenario` and `ResourceScenario` to check and reserve
 * time before booking. It keeps one counter per period (daily, weekly,
 * monthly).
 */
export class Limit {
  /** Limit name (`dailymax`, `weeklymax`, `monthlymax`, `maximum`, ...). */
  readonly name: string;
  /** Grid the counters are tracked on. */
  readonly interval: ScoreboardInterval;
  /** Length of one period, in seconds. */
  readonly period: number;
  /** Threshold the counters are compared against. */
  readonly value: number;
  /** `true` for an upper bound (max), `false` for a lower bound (min). */
  readonly upper: boolean;
  /** Resource the limit applies to, or `null` for any resource. */
  resource: Resource | null;
  /** Per-period counters. */
  private scoreboard: Scoreboard<number>;
  /** `true` when a counter changed since the last reset. */
  private dirty: boolean;

  /**
   * Creates a limit.
   *
   * @param name Limit name.
   * @param interval Grid the counters are tracked on.
   * @param period Length of one period, in seconds.
   * @param value Threshold the counters are compared against.
   * @param upper `true` for an upper bound, `false` for a lower bound.
   * @param resource Resource the limit applies to, or `null` for any.
   */
  constructor(
    name: string,
    interval: ScoreboardInterval,
    period: number,
    value: number,
    upper: boolean,
    resource: Resource | null = null,
  ) {
    this.name = name;
    this.interval = interval;
    this.period = period;
    this.value = value;
    this.upper = upper;
    this.resource = resource;
    this.scoreboard = new Scoreboard<number>(
      interval.startDate().toDate(),
      interval.endDate().toDate(),
      period,
      0,
    );
    this.dirty = false;
  }

  /**
   * Returns the internal scoreboard (for testing).
   *
   * @returns The per-period counters.
   */
  getScoreboard(): Scoreboard<number> {
    return this.scoreboard;
  }

  /**
   * Tells whether the limit changed since the last reset (for testing).
   *
   * @returns The dirty flag.
   */
  getDirty(): boolean {
    return this.dirty;
  }

  /**
   * Returns a deep copy of this limit.
   *
   * @returns An independent `Limit` with the same counters.
   */
  copy(): Limit {
    // Build a new ScoreboardInterval with the same values
    const newInterval = new ScoreboardInterval(
      this.interval.sbStart,
      this.interval.slotDuration,
      this.interval.start,
      this.interval.end,
    );
    const newLimit = new Limit(
      this.name,
      newInterval,
      this.period,
      this.value,
      this.upper,
      this.resource,
    );
    // Copy the scoreboard
    newLimit.scoreboard = new Scoreboard<number>(
      this.scoreboard.startDate,
      this.scoreboard.endDate,
      this.scoreboard.resolution,
      undefined,
    );
    for (let i = 0; i < this.scoreboard.size; i++) {
      newLimit.scoreboard.set(i, this.scoreboard.get(i,),);
    }
    newLimit.dirty = this.dirty;
    return newLimit;
  }

  /**
   * Resets the limit to its initial value (0).
   *
   * @param index When given, resets only the slot for this index (a `TjTime` is
   * converted first).
   */
  reset(index?: number | TjTime,): void {
    if (index !== undefined) {
      const idx = typeof index === "number"
        ? index
        : this.interval.dateToIndex(index,);
      if (this.interval.contains(idx,)) {
        this.scoreboard.set(idx, 0,);
      }
    } else {
      this.scoreboard.clear(0,);
    }
    this.dirty = false;
  }

  /**
   * Increments the counter of the given index/time, when allowed.
   *
   * @param index Index inside the limit interval (a `TjTime` is converted
   * first).
   * @param resource Resource that is allocating (used for filtering).
   */
  inc(index: number | TjTime, resource: Resource | null,): void {
    const idx = typeof index === "number"
      ? index
      : this.interval.dateToIndex(index,);
    if (!this.interval.contains(idx,)) {
      return;
    }
    if (this.resource !== null && this.resource !== resource) {
      return;
    }
    const current = this.scoreboard.get(idx,);
    this.scoreboard.set(idx, current + 1,);
    this.dirty = true;
  }

  /**
   * Decrements the counter of the given index/time, when allowed.
   *
   * @param index Index inside the limit interval (a `TjTime` is converted
   * first).
   * @param resource Resource that is releasing (used for filtering).
   */
  dec(index: number | TjTime, resource: Resource | null,): void {
    const idx = typeof index === "number"
      ? index
      : this.interval.dateToIndex(index,);
    if (!this.interval.contains(idx,)) {
      return;
    }
    if (this.resource !== null && this.resource !== resource) {
      return;
    }
    const current = this.scoreboard.get(idx,);
    this.scoreboard.set(idx, current - 1,);
    this.dirty = true;
  }

  /**
   * Tells whether the limit is satisfied for the given index/time.
   *
   * @param index Index inside the limit interval (a `TjTime` is converted
   * first). `null` checks every slot.
   * @param upper Whether to check the upper bound (max) or the lower one (min).
   * @param resource Resource that is checking (used for filtering).
   * @returns `true` when the limit is satisfied.
   */
  ok(
    index: number | TjTime | null,
    upper: boolean,
    resource: Resource | null,
  ): boolean {
    // If upper !== this.upper or the resource is filtered out, always true
    if (
      upper !== this.upper ||
      (this.resource !== null && this.resource !== resource)
    ) {
      return true;
    }

    if (index === null) {
      // Check every slot
      for (let i = 0; i < this.scoreboard.size; i++) {
        const value = this.scoreboard.get(i,);
        if (this.upper) {
          if (value >= this.value) {
            return false;
          }
        } else {
          if (value < this.value) {
            return false;
          }
        }
      }
      return true;
    }

    const targetIdx = typeof index === "number"
      ? index
      : this.interval.dateToIndex(index,);
    if (!this.interval.contains(targetIdx,)) {
      return true;
    }

    const sbIdx = this.idxToSbIdx(targetIdx,);
    const value = this.scoreboard.get(sbIdx,);

    if (this.upper) {
      // Upper bound: the value must be < this.value
      return value < this.value;
    } else {
      // Lower bound: the value must be >= this.value
      return value >= this.value;
    }
  }

  /**
   * Converts a project index into an index of the limit scoreboard.
   *
   * @param index Project slot index.
   * @returns The corresponding limit slot index.
   */
  private idxToSbIdx(index: number,): number {
    return Math.trunc(
      (index - this.interval.start) * this.interval.slotDuration / this.period,
    );
  }
}

/**
 * Collection of limits (`Limit[]`) attached to a project.
 *
 * `Limits` is used by `TaskScenario` and `ResourceScenario` to manage several
 * limits at once (dailymax, weeklymax, monthlymax, ...).
 */
export class Limits {
  /** Limits owned by this collection. */
  readonly limits: Limit[];
  /** Project the limits are aligned with, once attached. */
  private project: ProjectLike | null;

  /**
   * Creates a limits collection.
   *
   * @param limits Another collection or an array of limits, both deep-copied;
   * omit it for an empty collection.
   */
  constructor(limits?: Limit[] | Limits,) {
    if (limits instanceof Limits) {
      // Deep copy
      this.limits = limits.limits.map((limit,) => limit.copy());
      this.project = limits.project;
    } else if (Array.isArray(limits,)) {
      this.limits = limits.map((limit,) => limit.copy());
      this.project = null;
    } else {
      this.limits = [];
      this.project = null;
    }
  }

  /**
   * Returns the attached project (for testing).
   *
   * @returns The project, or `null` when none is attached.
   */
  getProject(): ProjectLike | null {
    return this.project;
  }

  /**
   * Attaches this `Limits` collection to a project.
   *
   * @param project Project the limits are aligned with.
   * @throws TjArgumentError When the collection is not empty.
   */
  setProject(project: ProjectLike,): void {
    if (this.limits.length > 0) {
      throw new TjArgumentError(
        "Cannot set project on Limits that already has limits",
      );
    }
    this.project = project;
  }

  /**
   * Resets every limit to its initial value (0).
   */
  reset(): void {
    for (const limit of this.limits) {
      limit.reset();
    }
  }

  /**
   * Adds or replaces a limit.
   *
   * @param name One of the limit kinds (`dailymax`, `weeklymax`, `monthlymax`,
   * `maximum`, `minimum`).
   * @param value Threshold of the limit, in seconds.
   * @param interval Optional custom `ScoreboardInterval`; when omitted it is
   * derived from the project.
   * @param resource Optional resource the limit applies to (per-resource
   * limits).
   * @throws TjArgumentError When the name is unknown, the project is missing
   * required attributes, or no interval can be derived.
   */
  setLimit(
    name: string,
    value: number,
    interval?: ScoreboardInterval,
    resource?: Resource,
  ): void {
    // Determine limit kind and period
    let period: number;
    let upper: boolean;

    switch (name) {
      case "dailymax":
      case "dailymin":
        period = 86400; // 1 day in seconds
        upper = name === "dailymax";
        break;
      case "weeklymax":
      case "weeklymin":
        period = 604800; // 1 week in seconds
        upper = name === "weeklymax";
        break;
      case "monthlymax":
      case "monthlymin":
        period = 2592000; // ~30 days in seconds
        upper = name === "monthlymax";
        break;
      case "maximum":
        period = interval
          ? interval.duration()
          : (this.project
            ? this.project.get("scheduleGranularity",) as number
            : 0);
        upper = true;
        break;
      case "minimum":
        period = interval
          ? interval.duration()
          : (this.project
            ? this.project.get("scheduleGranularity",) as number
            : 0);
        upper = false;
        break;
      default:
        throw new TjArgumentError(`Unknown limit name: ${name}`,);
    }

    // When no interval is given, derive one from the project
    if (!interval && this.project) {
      const startDate = this.project.get("start",);
      const endDate = this.project.get("end",);
      const scheduleGranularity = this.project.get(
        "scheduleGranularity",
      ) as number;

      if (!startDate || !endDate || !scheduleGranularity) {
        throw new TjArgumentError(
          "Project missing required attributes for limit interval",
        );
      }

      // startDate and endDate are already TjTime (from the Project)
      const startTime = startDate as TjTime;
      const endTime = endDate as TjTime;

      // Build an interval covering the whole project range
      const endIdx = Math.trunc(
        endTime.diff(startTime,) / scheduleGranularity,
      );
      interval = new ScoreboardInterval(
        startTime,
        scheduleGranularity,
        0,
        endIdx,
      );

      // Align start/end with the limit kind (as in Ruby Limits.rb)
      interval.start = interval.startDate().midnight();
      interval.end = interval.endDate().midnight();

      if (name.startsWith("weekly",)) {
        const weekStartsMonday = this.project.get(
          "weekStartsMonday",
        ) as boolean;
        interval.start = interval.startDate().beginOfWeek(weekStartsMonday,);
        interval.end = interval.endDate().beginOfWeek(weekStartsMonday,);
      } else if (name.startsWith("monthly",)) {
        interval.start = interval.startDate().beginOfMonth();
        interval.end = interval.endDate().beginOfMonth();
      }
    }

    if (!interval) {
      throw new TjArgumentError(
        `Interval must be provided or project must be set for limit: ${name}`,
      );
    }

    // Remove an existing limit with the same name, startDate, endDate, resource
    const startDate = interval.startDate(),
      endDate = interval.endDate();
    const existingIdx = this.limits.findIndex(
      (limit,) =>
        limit.name === name &&
        limit.interval.startDate().toSeconds() === startDate.toSeconds() &&
        limit.interval.endDate().toSeconds() === endDate.toSeconds() &&
        (limit.resource === resource || limit.resource === null ||
          resource === null),
    );
    if (existingIdx >= 0) {
      this.limits.splice(existingIdx, 1,);
    }

    // Create the new limit
    const limit = new Limit(name, interval, period, value, upper, resource,);
    this.limits.push(limit,);
  }

  /**
   * Increments the counter of the given index/time in every limit.
   *
   * @param index Index inside the limit intervals.
   * @param resource Resource that is allocating.
   */
  inc(index: number | TjTime, resource?: Resource,): void {
    const r = resource ?? null;
    for (const limit of this.limits) {
      limit.inc(index, r,);
    }
  }

  /**
   * Decrements the counter of the given index/time in every limit.
   *
   * @param index Index inside the limit intervals.
   * @param resource Resource that is releasing.
   */
  dec(index: number | TjTime, resource?: Resource,): void {
    const r = resource ?? null;
    for (const limit of this.limits) {
      limit.dec(index, r,);
    }
  }

  /**
   * Tells whether every limit is satisfied for the given index/time.
   *
   * @param index Index inside the limit intervals, or `null` for all slots.
   * @param upper Whether to check the upper bounds (default `true`).
   * @param resource Resource that is checking.
   * @returns `true` when every limit is satisfied.
   */
  ok(
    index: number | TjTime | null,
    upper?: boolean,
    resource?: Resource,
  ): boolean {
    const r = resource ?? null;
    for (const limit of this.limits) {
      if (!limit.ok(index, upper ?? true, r,)) {
        return false;
      }
    }
    return true;
  }
}
