import type { PropertySet, } from "./property-set.ts";
import type { Scenario, } from "./scenario.ts";
import type { Shift, } from "./shift.ts";
import type { Account, } from "./account.ts";
import type { CostType, } from "./account.ts";
import type { Resource, } from "./resource.ts";
import type { Task, } from "./task.ts";
import type { Report, } from "./report.ts";
import type { Material, } from "./material.ts";
import type { TjTime, } from "../time/tj-time.ts";
import type { TimeInterval, } from "../time/time-interval.ts";
import type { IntervalList, } from "../time/interval-list.ts";
import type { CostEvent, } from "./cost-event.ts";

/**
 * The project surface the model entities depend on.
 *
 * `Project` is the only production implementation, but the model is typed
 * against this interface so that a property tree can be built with a minimal
 * stand-in (tests, mock scenarios, isolated parse runs) without constructing
 * the whole scheduler. Everything an entity needs from "its project" — the
 * registries it belongs to, id lookups, calendar conversion and cost state —
 * is declared here.
 */
export interface ProjectLike {
  /** Number of declared scenarios. */
  readonly scenarioCount: number;
  /** Scenario at `idx`, or `null` when out of range. */
  scenario(idx: number,): { id: string; fullId: string } | null;
  /** Index of the scenario with that full id, or `undefined`. */
  scenarioIdx(sc: string,): number | undefined;
  /** Value of a project attribute. */
  get(name: string,): unknown;
  /** Writes a project attribute. */
  set(name: string, value: unknown,): void;
  /** Registers a scenario given by its id pair. */
  addScenario(scenario: { id: string; fullId: string },): void;
  /** Registers a scenario node. */
  addScenario(s: Scenario,): void;

  /** Declared scenarios. */
  readonly scenarios: PropertySet;
  /** Shift definitions. */
  readonly shifts: PropertySet;
  /** Chart of accounts. */
  readonly accounts: PropertySet;
  /** Resource hierarchy. */
  readonly resources: PropertySet;
  /** Task hierarchy. */
  readonly tasks: PropertySet;
  /** Report definitions. */
  readonly reports: PropertySet;
  /** Material catalog. */
  readonly materials: PropertySet;

  /** Registers a shift. */
  addShift(s: Shift,): void;
  /** Registers an account. */
  addAccount(a: Account,): void;
  /** Registers a task. */
  addTask(t: Task,): void;
  /** Registers a resource. */
  addResource(r: Resource,): void;
  /** Registers a report. */
  addReport(r: Report,): void;
  /** Registers a material. */
  addMaterial(m: Material,): void;
  /** Removes an account and everything that hangs off it. */
  removeAccount(a: Account,): void;

  /**
   * Default account of the project (`defaultaccount`).
   *
   * Optional: mocks and hand-built models need not provide it — rule 4 of
   * `resolveAccount` then falls back to `account: null`.
   */
  defaultAccountFor?(type: CostType | null,): Account | null;

  /**
   * Resolves a task id to a `Task` object.
   *
   * Used by `TaskDependency.resolve()` to turn cross references between tasks
   * into objects.
   */
  task(id: string,): Task | null;

  /**
   * Resolves a resource id to a `Resource` object.
   *
   * Used by `TaskScenario.preScheduleCheck()` to turn the ids stored in the
   * `responsible` attribute into `Resource` objects.
   */
  resource(id: string,): Resource | null;

  /**
   * Project-wide off-duty intervals (leaves, global off-times).
   *
   * Optional: mocks and hand-built models need not provide it —
   * `TaskScenario.collectTimeOffIntervals` then falls back to an empty list.
   */
  collectTimeOffIntervals?(
    iv: TimeInterval,
    minDuration: number,
  ): IntervalList<TimeInterval>;

  /** Resolves a material id to a `Material` object. */
  material(id: string,): Material | null;

  /**
   * Converts a `TjTime` date to its scheduling slot index.
   *
   * Used by `TaskScenario.prepareScheduling()` to compute the index of the
   * current day.
   *
   * @param date Date to convert.
   * @param forceIntoProject When `true` (the Ruby `Project#dateToIdx`
   *   behaviour) dates outside the plan are clamped to the project bounds;
   *   when `false` such a date is an error. Bookings pass `false` so they are
   *   not silently moved to the project edge.
   */
  dateToIdx(date: TjTime, forceIntoProject?: boolean,): number;

  /**
   * Converts a slot index back to a `TjTime` date.
   *
   * Used by `TaskScenario.schedule()` and `propagateDate()` while dates are
   * propagated along the dependency graph.
   */
  idxToDate(sbIdx: number,): TjTime;

  /**
   * Whether any resource is still available in the given slot.
   *
   * Used by `TaskScenario.bookResources()`.
   */
  anyResourceAvailable(sbIdx: number,): boolean;

  /**
   * Whether the given slot is working time.
   *
   * Used by `TaskScenario.onShiftCheck()` and `calcLength()`.
   */
  isWorkingTime(sbIdx: number,): boolean;

  /**
   * Converts a number of slots to working days.
   *
   * Used by `TaskScenario.postScheduleCheck()` to report gaps.
   */
  slotsToDays(slots: number,): number;

  /** Cost events collected by the accounting layer (phase 8.2). */
  readonly costEvents: CostEvent[];
  /** Id of the tracking scenario, or `null` when tracking is off. */
  readonly trackingScenario: string | null;
  /** Whether the scenario has bookings (actual effort already reported). */
  hasBookings(scenarioIdx: number,): boolean;
  /** Whether the scenario is a projection built from the others. */
  isProjectionMode(scenarioIdx: number,): boolean;
}
