import { TjArgumentError, TjTime, } from "../time/tj-time.ts";
import { Scoreboard, } from "../time/scoreboard.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { IntervalList, } from "../time/interval-list.ts";
import { ShiftScenario, } from "../model/shift-scenario.ts";
import { Resource, } from "../model/resource.ts";
import { ProjectLike, } from "../model/project-like.ts";
import { projectObjectId, } from "../utils/project-object-id.ts";
import {
  BIT_ASSIGNED,
  BIT_OFF_WORK,
  BIT_OVERRIDE,
  LEAVE_MASK,
  LEAVE_TYPES,
  packLeaveType,
} from "../time/scoreboard-bits.ts";

/**
 * Assignment of a shift to one time interval.
 *
 * Each `ShiftAssignment` pairs a `ShiftScenario` with a `TimeInterval`. The bit
 * encoding is computed lazily by `ShiftAssignments.getSbSlot`.
 */
export class ShiftAssignment {
  /** Shift that is assigned to the interval. */
  readonly shiftScenario: ShiftScenario;
  /** Interval covered by the assignment. */
  readonly interval: TimeInterval;

  /**
   * Creates an assignment.
   *
   * @param shiftScenario Shift assigned to the interval.
   * @param interval Interval covered by the assignment.
   */
  constructor(shiftScenario: ShiftScenario, interval: TimeInterval,) {
    this.shiftScenario = shiftScenario;
    this.interval = interval;
  }

  /**
   * Returns a deterministic hash key for this assignment.
   *
   * Used to share scoreboards between instances with identical content.
   *
   * @returns A key built from the project, scenario index and interval bounds.
   */
  hashKey(): string {
    const projectId = projectObjectId(this.shiftScenario.project,);
    const start = this.interval.start.toSeconds();
    const end = this.interval.end.toSeconds();
    return `${projectId}|${this.shiftScenario.scenarioIndex}|${start}|${end}`;
  }

  /**
   * Returns a deep copy of this assignment.
   *
   * @returns A new assignment holding a copied interval.
   */
  copy(): ShiftAssignment {
    return new ShiftAssignment(
      this.shiftScenario,
      new TimeInterval(this.interval,),
    );
  }

  /**
   * Tells whether this interval overlaps the given one.
   *
   * @param iv Interval to test.
   * @returns `true` when the two intervals overlap.
   */
  overlaps(iv: TimeInterval,): boolean {
    return this.interval.overlaps(iv,);
  }

  /**
   * Tells whether the date falls inside the interval and the shift replaces the
   * regular working hours.
   *
   * @param date Date to test.
   * @returns `true` when the date is covered by a replacing shift.
   */
  replace(date: TjTime,): boolean {
    return this.assigned(date,) && this.shiftScenario.replace();
  }

  /**
   * Tells whether the date falls inside the assignment interval.
   *
   * @param date Date to test.
   * @returns `true` when `date` is in `[start, end)`.
   */
  assigned(date: TjTime,): boolean {
    return date.greaterThanOrEqual(this.interval.start,) &&
      date.lessThan(this.interval.end,);
  }

  /**
   * Tells whether the shift defines working time on the given date.
   *
   * @param date Date to test.
   * @returns `true` when the shift is on duty at `date`.
   */
  onShift(date: TjTime,): boolean {
    return this.shiftScenario.onShift(date,);
  }

  /**
   * Tells whether the shift defines a leave on the given date.
   *
   * @param date Date to test.
   * @returns `true` when the shift marks a leave at `date`.
   */
  onLeave(date: TjTime,): boolean {
    return this.shiftScenario.onLeave(date,);
  }

  /**
   * Textual representation of this assignment.
   *
   * @returns The scenario index followed by the interval.
   */
  to_s(): string {
    return `<${this.shiftScenario.scenarioIndex}> ${this.interval.to_s()}`;
  }
}

/**
 * Manages shift assignments over time intervals, with lazy bit encoding.
 *
 * `ShiftAssignments` stores the assignments and computes the bit encoding for
 * each time slot on demand. Scoreboards are shared between instances that have
 * the same `hashKey` to save memory.
 */
export class ShiftAssignments {
  /** Project the assignments belong to, or `null` before it is set. */
  project: ProjectLike | null;
  /** Assignments in insertion order (sorted on demand by `hashKey`). */
  readonly assignments: ShiftAssignment[];
  /** Cached bit-encoded scoreboard, or `null` until it is built. */
  private scoreboard: Scoreboard<number | null> | null;
  /** Cached `hashKey`, invalidated when the assignment list changes. */
  private hashKeyCache: string | null;

  /**
   * Creates a shift assignment set, optionally as a copy of another one.
   *
   * @param sa Set to copy; when omitted an empty set is created.
   */
  constructor(sa?: ShiftAssignments,) {
    if (sa) {
      this.assignments = sa.assignments.map((a,) => a.copy());
      this.project = sa.project;
      this.scoreboard = null;
      this.hashKeyCache = null;
      // Create/share the scoreboard
      this.newScoreboard();
    } else {
      this.assignments = [];
      this.project = null;
      this.scoreboard = null;
      this.hashKeyCache = null;
    }
  }

  /**
   * Returns a deep copy of this instance.
   *
   * The assignments are copied through `ShiftAssignment.copy()`. The scoreboard
   * is reset to `null` (lazy computation) to avoid side effects while cloning.
   *
   * @returns An independent copy of this instance.
   * @see deepClone
   */
  deepClone(): ShiftAssignments {
    const clone = new ShiftAssignments();
    for (const a of this.assignments) {
      clone.assignments.push(a.copy(),);
    }
    clone.project = this.project;
    clone.scoreboard = null;
    clone.hashKeyCache = null;
    return clone;
  }

  /**
   * Adds an assignment when it does not overlap an existing one.
   *
   * @param sa Assignment to add.
   * @returns `true` when it was added, `false` on overlap.
   */
  addAssignment(sa: ShiftAssignment,): boolean {
    if (this.overlaps(sa.interval,)) {
      return false;
    }
    this.assignments.push(sa,);
    this.scoreboard = this.newScoreboard();
    return true;
  }

  /**
   * Tells whether any assignment overlaps the given interval.
   *
   * @param iv Interval to test.
   * @returns `true` when at least one assignment overlaps it.
   */
  overlaps(iv: TimeInterval,): boolean {
    for (const sa of this.assignments) {
      if (sa.overlaps(iv,)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns the scoreboard slot for the given index, computing it lazily when
   * needed.
   *
   * The bit encoding is:
   * - Bit 0 (BIT_ASSIGNED): an assignment covers this index.
   * - Bit 1 (BIT_OFF_WORK): no assignment provides working time.
   * - Bits 2–5 (LEAVE_MASK): kind of leave (holiday, annual, ...).
   * - Bit 8 (BIT_OVERRIDE): some assignment replaces the working hours.
   *
   * @param idx Scoreboard slot index.
   * @returns The encoded value of the slot.
   */
  getSbSlot(idx: number,): number {
    if (!this.scoreboard) {
      this.scoreboard = this.newScoreboard();
    }

    const cached = this.scoreboard.get(idx,);
    if (cached !== null) {
      return cached;
    }

    // Convert idx to TjTime (as in Ruby: getSbSlot uses the slot date).
    const date = TjTime.fromDate(this.scoreboard.idxToDate(idx,),);

    // Compute the lazy encoding
    let val = 0;
    let hasAssignment = false;

    for (const sa of this.assignments) {
      if (!sa.assigned(date,)) {
        continue;
      }
      hasAssignment = true;
      val |= BIT_ASSIGNED;

      if (!sa.onShift(date,)) {
        val |= BIT_OFF_WORK;
      }

      if (sa.onLeave(date,)) {
        val |= packLeaveType(LEAVE_TYPES.holiday,);
      }

      if (sa.replace(date,)) {
        val |= BIT_OVERRIDE;
      }
    }

    if (!hasAssignment) {
      val = 0;
    }

    this.scoreboard.set(idx, val,);
    return val;
  }

  /**
   * Tells whether an assignment covers the given index.
   *
   * @param idx Scoreboard slot index.
   * @returns `true` when bit 0 is set.
   */
  assigned(idx: number,): boolean {
    return (this.getSbSlot(idx,) & BIT_ASSIGNED) !== 0;
  }

  /**
   * Tells whether working time is available at the given index.
   *
   * @param idx Scoreboard slot index.
   * @returns `true` when bit 1 is clear.
   */
  onShift(idx: number,): boolean {
    return (this.getSbSlot(idx,) & BIT_OFF_WORK) === 0;
  }

  /**
   * Tells whether working time is **not** available at the given index.
   *
   * @param idx Scoreboard slot index.
   * @returns `true` when bit 1 is set.
   */
  timeOff(idx: number,): boolean {
    return (this.getSbSlot(idx,) & BIT_OFF_WORK) !== 0;
  }

  /**
   * Tells whether a leave is registered at the given index.
   *
   * @param idx Scoreboard slot index.
   * @returns `true` when any leave bit is set.
   */
  onLeave(idx: number,): boolean {
    return (this.getSbSlot(idx,) & LEAVE_MASK) !== 0;
  }

  /**
   * Collects the off-duty intervals of an interval, with a minimum duration.
   *
   * @param iv Interval to scan.
   * @param minDuration Minimum length of a reported interval, in seconds.
   * @returns The off-duty intervals found inside `iv`.
   */
  collectTimeOffIntervals(
    iv: TimeInterval,
    minDuration: number,
  ): IntervalList<TimeInterval> {
    if (!this.scoreboard) {
      this.scoreboard = this.newScoreboard();
    }
    return this.scoreboard.collectIntervals(
      iv,
      minDuration,
      (v,) => (v! & BIT_OFF_WORK) !== 0,
    );
  }

  /**
   * Returns a deterministic hash key for the whole set of assignments.
   *
   * The assignments are sorted by `interval.start` before the key is built.
   *
   * @returns The joined per-assignment hash keys.
   */
  hashKey(): string {
    if (this.hashKeyCache) {
      return this.hashKeyCache;
    }

    // Sort assignments by interval.start (in place, as in Ruby)
    this.assignments.sort((a, b,) =>
      a.interval.start.toSeconds() - b.interval.start.toSeconds()
    );

    const parts = this.assignments.map((a,) => a.hashKey());
    this.hashKeyCache = parts.join("||",);
    return this.hashKeyCache;
  }

  /**
   * Textual representation, for debugging.
   *
   * @returns `"shifts ..."` followed by every assignment, or an empty string.
   * @see docs/taskjuggler/lib/taskjuggler/ShiftAssignments.rb:to_s
   */
  to_s(): string {
    if (this.assignments.length === 0) {
      return "";
    }
    const parts = this.assignments.map((a,) => a.to_s());
    return "shifts " + parts.join(", ",);
  }

  /**
   * Creates or returns a scoreboard shared for this `hashKey`.
   *
   * When the key already exists in the static cache, the object id is added to
   * its `Set` and the shared scoreboard is returned. Otherwise a new scoreboard
   * is created with `initVal` `null` (lazy computation) and registered.
   *
   * @returns The shared scoreboard for the current assignments.
   * @throws TjArgumentError When the project is not set or lacks the required
   * attributes.
   */
  newScoreboard(): Scoreboard<number | null> {
    const key = this.hashKey();
    const objId = projectObjectId(this.project ?? {},);

    const record = ShiftAssignments.scoreboards.get(key,);
    if (record) {
      record[0].add(objId,);
      return record[1];
    }

    if (!this.project) {
      throw new TjArgumentError("Project must be set to create scoreboard",);
    }

    const startRaw = this.project.get("start",);
    const endRaw = this.project.get("end",);
    const granularity = this.project.get("scheduleGranularity",) as number;

    const start = startRaw instanceof TjTime
      ? new Date(startRaw.toSeconds() * 1000,)
      : startRaw as Date;
    const end = endRaw instanceof TjTime
      ? new Date(endRaw.toSeconds() * 1000,)
      : endRaw as Date;

    if (!start || !end || !granularity) {
      throw new TjArgumentError(
        "Project missing required attributes for scoreboard",
      );
    }

    const sb = new Scoreboard<number | null>(start, end, granularity, null,);
    const ids = new Set<number>();
    ids.add(objId,);
    ShiftAssignments.scoreboards.set(key, [ids, sb,],);

    // Register a FinalizationRegistry entry to clean up when GC'ed
    ShiftAssignments.finalizer.register(this, { key, objId, },);

    return sb;
  }

  /**
   * Clears the static scoreboard cache (used in tests).
   */
  static sbClear(): void {
    ShiftAssignments.scoreboards.clear();
  }

  /**
   * Removes one object id reference from the static cache.
   *
   * When the `Set` becomes empty, the `Map` entry is deleted.
   *
   * @param objId Object id to remove.
   */
  static deleteScoreboard(objId: number,): void {
    for (const [key, [ids, sb,],] of ShiftAssignments.scoreboards) {
      ids.delete(objId,);
      if (ids.size === 0) {
        ShiftAssignments.scoreboards.delete(key,);
      }
    }
  }

  /** Static cache of shared scoreboards (hashKey → [Set<objectId>, Scoreboard]). */
  static scoreboards: Map<string, [Set<number>, Scoreboard<number | null>,]> =
    new Map();

  /** FinalizationRegistry that cleans the cache when instances are GC'ed. */
  static finalizer: FinalizationRegistry<{ key: string; objId: number }> =
    new FinalizationRegistry<{ key: string; objId: number }>(
      (heldValue,) => {
        ShiftAssignments.deleteScoreboard(heldValue.objId,);
      },
    );
}
