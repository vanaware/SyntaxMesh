import { ScenarioData, } from "./scenario-data.ts";
import {
  resolveTimebasis,
  type Timebasis,
} from "../accounting/distribution.ts";
import { Task, } from "./task.ts";
import { type Resource, } from "./resource.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type PropertyLike, } from "./property-like.ts";
import {
  PropertyTreeNode,
  type SourceFileInfo,
} from "./property-tree-node.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";
import { Booking, } from "../scheduling/booking.ts";
import { TjTime, } from "../time/tj-time.ts";
import { Allocation, } from "../scheduling/allocation.ts";
import { TaskDependency, } from "../scheduling/task-dependency.ts";
import { ShiftAssignments, } from "../scheduling/shift-assignments.ts";
import { DurationType, } from "../scheduling/mod.ts";
import { Limits, } from "../scheduling/limits.ts";
import { type Account, } from "./account.ts";
import { ResourceScenario, } from "./resource-scenario.ts";
import { Charge, } from "../finance/charge.ts";
import { ChargeSet, } from "../finance/charge-set.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { IntervalList, } from "../time/interval-list.ts";
import { CostLine, resolveAccount, } from "../accounting/attribution.ts";
import { CostEvent, createCostEvent, } from "../accounting/cost-event.ts";
import { RichText, } from "../richtext/rich-text.ts";
import { RTFHandlers, } from "../richtext/handlers/rtf-handlers.ts";

/** Entrada de `startsuccs`/`endsuccs`/`startpreds`/`endpreds` (Ruby par). */
export type DependencyEntry = [Task | null, boolean,];

/**
 * Every attribute name a task carries per scenario.
 *
 * The list is the attribute map of {@link TaskScenario}: `a(name)` only sees
 * what is registered here, so dependency accessors (`startpreds`, …) must be
 * present even though they are computed by `Xref` rather than parsed.
 */
export const TASK_SCENARIO_ATTRS: string[] = [
  "allocate",
  "assignedresources",
  "booking",
  "charge",
  "chargeset",
  "complete",
  "competitors",
  "criticalness",
  "depends",
  "duration",
  "effort",
  "effortdone",
  "effortleft",
  "end",
  "forward",
  "gauge",
  "length",
  "maxend",
  "maxstart",
  "minend",
  "minstart",
  "milestone",
  "pathcriticalness",
  "precedes",
  "priority",
  "projectionmode",
  "responsible",
  "scheduled",
  "shifts",
  "start",
  // Dependency lists resolved in `Xref` (Ruby instantiates them in
  // `TaskScenario#initialize`). They must be in the attribute map so that
  // `a("startsuccs")`/`hasDependency` as enxerguem.
  "startpreds",
  "startsuccs",
  "endpreds",
  "endsuccs",
  "status",
  "timebasis",
];

/**
 * Structural subset of `Query` consumed by the TaskScenario `query_*` methods
 * (wave B2). Just as `account-scenario.ts` declares its own `Query`, the model
 * does not import the query layer (avoids a cycle); the real object passed by
 * `Query.process` satisfies this shape.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Query.rb
 */
export interface TaskScenarioQuery {
  /** Report interval start, or `null` for an open start. */
  readonly start: TjTime | null;
  /** Report interval end, or `null` for an open end. */
  readonly end: TjTime | null;
  /** Start slot of {@link TaskScenarioQuery.start}, or `null`. */
  readonly startIdx: number | null;
  /** End slot of {@link TaskScenarioQuery.end}, or `null`. */
  readonly endIdx: number | null;
  /** Index of the scenario being reported. */
  scenarioIdx?: number | undefined;
  /** Property the query is rooted at, or `null` for the project itself. */
  property?: PropertyTreeNode | null;
  /** Parent property that scopes the query, or `null` when unscoped. */
  scopeProperty?: PropertyTreeNode | null;
  /** Cost account to bill against, or `null` for none. */
  costAccount?: string | null;
  /** Revenue account to credit, or `null` for none. */
  revenueAccount?: string | null;
  /** `strftime`-style pattern used for dates, or `null` for the default. */
  timeFormat?: string | null;
  /** Bullet or label to prefix list items with, or `null`. */
  listItem?: string | null;
  /** Formatter for plain numbers, or `null` when unformatted output is fine. */
  readonly numberFormat: { format(value: number,): string } | null;
  /** Formatter for money amounts, or `null` for unformatted output. */
  readonly currencyFormat: { format(value: number,): string } | null;
  /** Value used when the column is sorted; set by the processing step. */
  sortable: unknown;
  /** Value used when the column is aggregated; set by the processing step. */
  numerical: unknown;
  /** Textual value of the cell being produced, or `null` before any. */
  string: string | null;
  /** Rich-text intermediate the report is being built into. */
  rti: unknown;
  /** Formats a duration in project units for display. */
  scaleDuration(value: number,): string;
  /** Formats a load (effort per period) for display. */
  scaleLoad(value: number,): string;
  /** Appends an already-formatted list of items to the current cell. */
  assignList(items: string[],): void;
  /** Shallow copy, so nested queries cannot mutate the caller's state. */
  dup(): TaskScenarioQuery;
  /**
   * Stores a dynamic-attribute value under `name`.
   *
   * @param name Column name of the dynamic attribute.
   * @param data Value in every representation the report layer understands.
   */
  setCustomData(
    name: string,
    data: {
      string?: string;
      numerical?: number;
      sortable?: unknown;
      rti?: unknown;
    },
  ): void;
}

/**
 * Scheduling state of a task in one scenario.
 *
 * One {@link TaskScenario} exists per task per scenario: it holds the parsed
 * attributes, the computed schedule (start/end slots, duration, effort), the
 * allocation and dependency bookkeeping the scheduler fills in, and the query
 * methods (`query_*`) the reports call. Everything that differs between
 * scenarios lives here; everything shared lives in {@link Task}.
 */
export class TaskScenario extends ScenarioData {
  private _candidates: Resource[] = [];
  private _isRunAway: boolean = false;
  private _hasDurationSpec: boolean = false;
  private _currentSlotIdx: number | null = null;
  private _doneDuration: number = 0;
  private _doneLength: number = 0;
  private _doneEffort: number = 0.0;
  private _nowIdx: number = 0;
  private _startIdx: number | null = null;
  private _endIdx: number | null = null;
  private _startIsDetermed: boolean | null = null;
  private _endIsDetermed: boolean | null = null;
  private _startPropagated: boolean = false;
  private _endPropagated: boolean = false;
  private _allLimits: unknown[] = [];
  private _contendedResources: Map<Task, Map<Resource, number>> = new Map();
  private _mandatories: Allocation[] = [];
  private _competitors: Task[] = [];
  private _deadEndFlags: boolean[] = [false, false, false, false,];
  private _criticalness: number = 0.0;
  private _pathcriticalness: number | null = null;
  private _complete: number | null = null;
  private _status: string = "";
  private _gauge: string | null = null;
  private _errors: number = 0;
  private _scheduled: boolean = false;
  // Own guard of the *finish* pass (bottom-up recursion + merge of
  // `assignedresources`). Separate from `_scheduled` because `markAsScheduled()`
  // already raises `_scheduled` during the main pass, which would make the
  // `_scheduled` guard skip the housekeeping here. `Project#finishScenario`
  // calls `finishScheduling` once per scenario (Ruby has no guard — the tree is
  // walked once); `_finishDone` replicates that "once" safely against the
  // re-entrancy of `propagateDateToDep`.
  private _finishDone: boolean = false;
  private _durationType: string = "";
  /**
   * Effective time basis resolved during scheduling (§2.4), computed by
   * `prepareScheduling()`.
   *
   * Used for cost calculation only — it never influences the schedule.
   */
  resolvedTimebasis: Timebasis = "duration";
  private _shifts: ShiftAssignments | null = null;

  /**
   * Dependency lists (incoming/outgoing, start/end) of the scenario.
   *
   * RUBY-COMPAT-FIX: in Ruby `@startsuccs`, `@endsuccs`, `@startpreds` and
   * `@endpreds` **are** the values of the same-named attributes (instantiated in
   * `TaskScenario#initialize`), the very ones the Gantt reads via
   * `task[kind, scenarioIdx]`. With parallel arrays, `hasDependency` — which
   * reads the attribute — always returned `false` and the chart drew arrows for
   * the inherited dependencies (one arrow too many per nested task).
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:hasDependency?
   */
  private get _startpreds(): DependencyEntry[] {
    return this.dependencyList("startpreds",);
  }
  /** Start-successors list, read from the `startsuccs` attribute. */
  private get _startsuccs(): DependencyEntry[] {
    return this.dependencyList("startsuccs",);
  }
  /** End-predecessors list, read from the `endpreds` attribute. */
  private get _endpreds(): DependencyEntry[] {
    return this.dependencyList("endpreds",);
  }
  /** End-successors list, read from the `endsuccs` attribute. */
  private get _endsuccs(): DependencyEntry[] {
    return this.dependencyList("endsuccs",);
  }

  /** Dependency list of attribute `id`, created empty when needed. */
  private dependencyList(id: string,): DependencyEntry[] {
    const stored = this.a(id,) as DependencyEntry[] | null;
    if (stored !== null) return stored;
    const created: DependencyEntry[] = [];
    // `forceForScenario` (= `attr.set`) instead of `setForScenario`: Ruby only
    // instantiates the attribute (`@property[attr, @scenarioIdx]`), without
    // propagating it to the other scenarios.
    (this.getProperty() as Task).forceForScenario(
      id,
      created,
      this.getScenarioIdx(),
    );
    return created;
  }

  /**
   * Creates the per-scenario state of `task` and preloads the attribute map.
   *
   * @param task Task this state belongs to.
   * @param scIdx Scenario index.
   * @param attributes Attribute definitions shared by the project.
   */
  constructor(
    task: Task,
    scIdx: number,
    attributes: Map<string, AttributeBase<unknown>>,
  ) {
    super(task, scIdx, attributes,);
    this.preloadAttributes(TASK_SCENARIO_ATTRS,);
  }

  /**
   * Flags the task as scheduled, mirroring the flag into the property bag.
   *
   * Idempotent: the scheduler calls it from several passes, and the `scheduled`
   * attribute is what later passes read to skip work.
   */
  markAsScheduled(): void {
    if (this._scheduled) return;
    this._scheduled = true;
    // Ruby: `scheduled` is a runtime attribute read through `@scheduled`
    // (TaskScenario.rb:57-59). In the port the bag is the read channel
    // (`a("scheduled")` in scheduleContainer/propagateDateToDep), so we mirror
    // the flag into the property bag when marking.
    (this.getProperty() as Task).forceForScenario(
      "scheduled",
      true,
      this.getScenarioIdx(),
    );
  }

  /**
   * Resets the per-scenario scheduling bookkeeping before a scheduling run.
   *
   * Empties the four dependency lists, clears the computed schedule and
   * re-derives {@link resolvedTimebasis} from the task's `timebasis` attribute.
   */
  prepareScheduling(): void {
    const scIdx = this.getScenarioIdx();
    (this.getProperty() as Task).setForScenario("startpreds", [], scIdx,);
    (this.getProperty() as Task).setForScenario("startsuccs", [], scIdx,);
    (this.getProperty() as Task).setForScenario("endpreds", [], scIdx,);
    (this.getProperty() as Task).setForScenario("endsuccs", [], scIdx,);

    this._isRunAway = false;
    this._currentSlotIdx = null;
    this._doneDuration = 0;
    this._doneLength = 0;
    this._doneEffort = 0.0;

    const project = (this.getProperty() as Task).project as ProjectLike;
    this._nowIdx = project.dateToIdx(project.get("now",) as TjTime,);

    this._startIsDetermed = null;
    this._endIsDetermed = null;
    this._startPropagated = false;
    this._endPropagated = false;

    const effort = this.a("effort",) as number;
    const length = this.a("length",) as number;
    const duration = this.a("duration",) as number;
    const milestone = this.a("milestone",) as boolean;

    let durationType: string;
    if (effort > 0) {
      this._hasDurationSpec = true;
      durationType = "effortTask";
    } else if (length > 0) {
      this._hasDurationSpec = true;
      durationType = "lengthTask";
    } else if (duration > 0) {
      this._hasDurationSpec = true;
      durationType = "durationTask";
    } else {
      this._hasDurationSpec = milestone;
      durationType = "startEndTask";
    }
    this._durationType = durationType;

    // C2.5: resolves the effective timebasis (§2.4) once per schedule cycle.
    // Does not affect scheduling — only the cost distribution.
    this.resolvedTimebasis = resolveTimebasis(
      this.getProperty() as Task,
      scIdx,
      project,
    );

    this.markAsMilestone();

    // Ruby (TaskScenario.rb:121-123): start-end tasks without allocation have
    // nothing to schedule — just mark them as scheduled. This shortcut was
    // missing in the port: such tasks fell into the `scheduleSlot` loop with
    // `durationType` `startEndTask`/no dates and blew up with
    // `Unknown task duration type` when `schedule()` ran without
    // `prepareScheduling`.
    if (durationType === "startEndTask") {
      const start = this.a("start",) as TjTime | null;
      const end = this.a("end",) as TjTime | null;
      const allocate = this.a("allocate",) as Allocation[] | null;
      if (start && end && !allocate?.length) {
        this.markAsScheduled();
      }
    }

    this._allLimits = [];
    let task: PropertyTreeNode | null = this.getProperty();
    while (task) {
      const limits = task.getForScenario("limits", scIdx,);
      if (limits) this._allLimits.push(limits,);
      task = task.parent;
    }

    this._contendedResources = new Map();

    this._mandatories = [];
    const allocate = this.a("allocate",) as Allocation[];
    if (allocate) {
      for (const allocation of allocate) {
        if (allocation.mandatory) this._mandatories.push(allocation,);
        allocation.lockedResource = null;
      }
    }

    this.bookBookings();

    if (durationType === "startEndTask") {
      const start = this.a("start",) as TjTime;
      const end = this.a("end",) as TjTime;
      if (start) {
        this._startIdx = project.dateToIdx(start,);
      }
      if (end) {
        this._endIdx = project.dateToIdx(end,);
      }
    }
  }

  /**
   * Resolves every parsed dependency into the four scenario lists.
   *
   * Run once per scenario after parsing: turns the symbolic `depends` and
   * `precedes` attributes into concrete `startpreds`/`endsuccs` entries (and
   * their inverses), reporting unknown or self-referencing tasks through the
   * message handler.
   */
  Xref(): void {
    const scIdx = this.getScenarioIdx();
    const depends = this.a("depends",) as TaskDependency[];
    if (depends) {
      for (const dependency of depends) {
        const depTask = this.checkDependency(dependency, "depends",);
        if (depTask) {
          this._startpreds.push([depTask, dependency.onEnd,],);
          // Ruby (TaskScenario.rb:170): the successor goes to `endsuccs` when
          // the dependency is on-end and to `startsuccs` otherwise. The flag
          // propagated to the dep is always false (defines the dependent start).
          const depSc = depTask.scenarioData(scIdx,) as TaskScenario;
          (dependency.onEnd ? depSc._endsuccs : depSc._startsuccs).push([
            this.getProperty(),
            false,
          ],);
        }
      }
    }
    const precedes = this.a("precedes",) as TaskDependency[];
    if (precedes) {
      for (const dependency of precedes) {
        const predTask = this.checkDependency(dependency, "precedes",);
        if (predTask) {
          this._endsuccs.push([predTask, dependency.onEnd,],);
          // Ruby (TaskScenario.rb:177): the predecessor goes to `endpreds` when
          // on-end and to `startpreds` otherwise. Propagated flag: true.
          const predSc = predTask.scenarioData(scIdx,) as TaskScenario;
          (dependency.onEnd ? predSc._endpreds : predSc._startpreds).push([
            this.getProperty(),
            true,
          ],);
        }
      }
    }
  }

  /**
   * `true` when the `depType` category (`startsuccs`, `endsuccs`, ...) contains
   * the `[target, onEnd]` pair.
   *
   * RUBY-COMPAT-FIX: the lists hold **pairs** `[task, flag]` (see `Xref`), and
   * Ruby compares with `Array#include?([target, onEnd])`. Before, the port read
   * the items as `TaskDependency` (`dependency.task`), so every pair gave
   * `false` and the Gantt did not filter out the inherited dependencies.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:hasDependency?
   */
  hasDependency(
    depType: string,
    target: Task | null,
    onEnd: boolean,
  ): boolean {
    const list = this.a(depType,) as DependencyEntry[] | null;
    if (!list) return false;
    return list.some(([task, entryOnEnd,],) =>
      task === target && entryOnEnd === onEnd
    );
  }

  /**
   * Checks and resolves a cross dependency.
   *
   * Ruby (TaskScenario.rb:2318-2326) calls `dependency.resolve(@project)`, which
   * assigns `@task = project.task(@taskId)` and returns it. The port needs that
   * assignment: `earliestStart`/`latestEnd` walk `depends` reading
   * `dependency.task` (TaskScenario.rb:1176-1178); without it the predecessor
   * date is never found and the dependent never receives the propagated start
   * (phase 7 placement gap on models coming from the parser).
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:checkDependency
   */
  checkDependency(dependency: TaskDependency, depType: string,): Task | null {
    const task = this.project().task(dependency.taskId,);
    if (!task) {
      this.error("unknown_task", `Unknown task '${dependency.taskId}'`,);
      return null;
    }
    // Equivalent to `TaskDependency#resolve`: pins the target reference.
    dependency.task = task;
    return task;
  }

  /**
   * Propagates a date (start or end) to the task, to the direct dependents, to
   * the children that may inherit the date and to the enclosing containers.
   *
   * Faithful port of `TaskScenario.rb#propagateDate` (980-1074). The previous
   * version stored only `@startIdx`/`@endIdx` and never wrote the `start`/`end`
   * attributes into the bag — tasks finished their effort but ended up with no
   * end date (`task_end_undef`). In the port the date storage is the property
   * bag via `setForScenario` (a channel already used by `scheduleContainer` and
   * `prepareScheduling`), equivalent to Ruby's `instance_variable_set` plus
   * attribute.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:propagateDate
   */
  propagateDate(
    date: TjTime,
    atEnd: boolean,
    ignoreEffort: boolean = false,
  ): void {
    const property = this.getProperty() as Task;
    const scIdx = this.getScenarioIdx();
    const thisEnd = atEnd ? "end" : "start";
    const otherEnd = atEnd ? "start" : "end";

    // De-duplication flags during propagateInitialValues().
    if (atEnd) {
      this._endPropagated = true;
    } else {
      this._startPropagated = true;
    }

    // Leaf tasks may set/shrink the date; containers only in
    // scheduleContainer().
    if (property.leaf?.()) {
      const setDate = this.a(thisEnd,) as TjTime | null;
      // If a date already exists for this end, we only shrink the period.
      if (
        setDate &&
        (atEnd ? date.compareTo(setDate,) > 0 : date.compareTo(setDate,) < 0)
      ) {
        return;
      }
      // `forceForScenario` (no overwrite guard): the scheduler writes a runtime
      // value, not parser input — equivalent to Ruby's `instance_variable_set`
      // (TaskScenario.rb:1012).
      property.forceForScenario(thisEnd, date, scIdx,);
      if (this.durationType() === "startEndTask") {
        if (atEnd) {
          this._endIdx = this.project().dateToIdx(date,);
        } else {
          this._startIdx = this.project().dateToIdx(date,);
        }
      }
    }

    if (this.a("milestone",)) {
      // The start and end of a milestone are identical.
      this.markAsScheduled();
      if (this.a(otherEnd,) === null) {
        this.propagateDate(this.a(thisEnd,) as TjTime, !atEnd,);
      }
    } else if (
      !this._scheduled && this.a("start",) && this.a("end",) &&
      !(
        (this.a("length",) as number) === 0 &&
        (this.a("duration",) as number) === 0 &&
        (this.a("effort",) as number) === 0 &&
        ((this.a("allocate",) as Allocation[]) ?? []).length > 0
      )
    ) {
      this.markAsScheduled();
    }

    // Propagates to the direct dependents. For on-end-successors / on-start
    // preds of an effort-based task the date may still change (bookResource()
    // propagates the end date), except when ignoreEffort.
    if (atEnd) {
      if (ignoreEffort || (this.a("effort",) as number) === 0) {
        for (const [task, onEnd,] of this._endpreds) {
          if (task) this.propagateDateToDep(task, onEnd,);
        }
      }
      for (const [task, onEnd,] of this._endsuccs) {
        if (task) this.propagateDateToDep(task, onEnd,);
      }
    } else {
      if (ignoreEffort || (this.a("effort",) as number) === 0) {
        for (const [task, onEnd,] of this._startsuccs) {
          if (task) this.propagateDateToDep(task, onEnd,);
        }
      }
      for (const [task, onEnd,] of this._startpreds) {
        if (task) this.propagateDateToDep(task, onEnd,);
      }
    }

    // Implicit date of the children that may inherit this parent end.
    for (const child of property.children as Task[]) {
      const childSc = child.scenarioData(scIdx,) as TaskScenario;
      if (childSc.canInheritDate(atEnd,)) {
        childSc.propagateDate(date, atEnd, false,);
      }
    }

    // The propagation may have completed the parent container's interval.
    for (const parent of property.parents()) {
      (parent as Task).scenarioData(scIdx,).scheduleContainer();
    }
  }

  /** Start slot of the task, or `null` while it is still undetermined. */
  startIdx(): number | null {
    return this._startIdx;
  }

  /** End slot of the task, or `null` while it is still undetermined. */
  endIdx(): number | null {
    return this._endIdx;
  }

  /**
   * Checks whether the task may inherit a date from the scenario.
   *
   * Port faithful to `TaskScenario.rb#canInheritDate?` (1080-1121) using the
   * bag primitives (`a("start")`/`a("end")` in place of the `@start`/
   * `@end` ivars).
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:canInheritDate?
   */
  canInheritDate(end: boolean,): boolean {
    const thisEnd = end ? "end" : "start";
    const thatEnd = end ? "start" : "end";

    // False when a date already exists for this end or a strong dependency is
    // on it.
    if (this.a(thisEnd,) !== null) return false;
    if (this.hasStrongDeps(end,)) return false;

    // Containers inherit when they have no dependencies on this end.
    if ((this.getProperty() as Task).container?.()) return true;

    const hasThatSpec = this.a(thatEnd,) !== null ||
      this.hasStrongDeps(!end,);

    // Sem start/end spec, sem duration spec, mas com allocations: herda.
    if (hasThatSpec && !this._hasDurationSpec && this._allocateNotEmpty()) {
      return true;
    }

    if (this.forward() !== end) {
      // The scheduling direction points away from this end.
      if (this._hasDurationSpec || this.bookingNotEmpty()) return true;
      return hasThatSpec;
    } else {
      // The direction points towards this end.
      return this.a(thatEnd,) !== null && !this._hasDurationSpec &&
        !this.bookingNotEmpty();
    }
  }

  /** `true` when at least one `allocate` entry is present. */
  private _allocateNotEmpty(): boolean {
    const allocate = this.a("allocate",) as Allocation[] | null;
    return !!allocate && allocate.length > 0;
  }

  /** `true` when at least one `booking` entry is present. */
  private bookingNotEmpty(): boolean {
    const booking = this.a("booking",) as unknown[] | null;
    return !!booking && booking.length > 0;
  }

  /**
   * Seeds the schedule from the explicit start/end dates, then propagates.
   *
   * Counterpart of the first half of the Ruby `prepareScheduling`: a task that
   * already knows one of its ends hands that date to its dependencies, which is
   * what lets a partly-fixed plan be scheduled around the fixed points.
   */
  propagateInitialValues(): void {
    const project = (this.getProperty() as Task).project as ProjectLike;
    if (!this._startPropagated) {
      const start = this.a("start",) as TjTime;
      if (start) {
        this.propagateDate(start, false, true,);
      } else if (
        this.getProperty().parent === null &&
        this.canInheritDate(false,)
      ) {
        this.propagateDate(project.get("start",) as TjTime, false, true,);
      }
    }
    if (!this._endPropagated) {
      const end = this.a("end",) as TjTime;
      if (end) {
        this.propagateDate(end, true, true,);
      } else if (
        this.getProperty().parent === null &&
        this.canInheritDate(true,)
      ) {
        this.propagateDate(project.get("end",) as TjTime, true, true,);
      }
    }
  }

  /**
   * Validates and applies the `milestone` flag.
   *
   * A milestone must be a leaf with zero duration; a container marked as a
   * milestone is rejected with `container_milestone` and a non-zero duration
   * with `milestone_duration`.
   */
  markAsMilestone(): void {
    const milestone = this.a("milestone",) as boolean;
    const property = this.getProperty() as Task;
    if (milestone && property.container?.()) {
      this.error(
        "container_milestone",
        `Container task ${property.fullId} may not be marked as a milestone.`,
      );
      return;
    }

    // Ruby: `return if @property.container? || @hasDurationSpec ||
    //   !@booking.empty? || !@allocate.empty?`. The automatic promotion only
    // happens when booking AND allocate are both empty.
    const bookingLen = (this.a("booking",) as unknown[])?.length ?? 0;
    const allocateLen = (this.a("allocate",) as Allocation[])?.length ?? 0;
    if (
      property.container?.() || this._hasDurationSpec || bookingLen ||
      allocateLen
    ) {
      return;
    }

    const hasStartSpec = !!(this.a("start",) as TjTime) ||
      !!(this.a("depends",) as TaskDependency[])?.length;
    const hasEndSpec = !!(this.a("end",) as TjTime) ||
      !!(this.a("precedes",) as TaskDependency[])?.length;

    const newMilestone =
      (hasStartSpec && this.a("forward",) as boolean && !hasEndSpec) ||
      (!hasStartSpec && !(this.a("forward",) as boolean) && hasEndSpec) ||
      (!hasStartSpec && !hasEndSpec);

    if (newMilestone) {
      this._hasDurationSpec = true;
      // Ruby: `@milestone = true` — mirrors it into the bag for `a("milestone")`
      // reads.
      property.forceForScenario("milestone", true, this.getScenarioIdx(),);
      const start = this.a("start",) as TjTime;
      const end = this.a("end",) as TjTime;
      if (start && !end) {
        // Ruby `@end = @start` — ivar assignment without the `provided` guard.
        property.forceForScenario("end", start, this.getScenarioIdx(),);
      } else if (!start && end) {
        property.forceForScenario("start", end, this.getScenarioIdx(),);
      }
    }
  }

  /**
   * Records the user bookings in the resource scoreboards and derives the
   * "already done" state of the task.
   *
   * Besides reserving the slots, this method accumulates `doneEffort`,
   * `doneLength`/`doneDuration` and positions `currentSlotIdx` at `now` —
   * without it the task would reschedule the whole effort from the beginning
   * (instead of resuming what is left from `now`), and the reported `end` comes
   * out days early. That is what the mwe006 Gantt golden exposed (t2 ended two
   * days early).
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:bookBookings
   */
  bookBookings(): void {
    const task = this.getProperty() as Task;
    const project = this.project();
    const scIdx = this.getScenarioIdx();
    let firstSlotIdx: number | null = null;
    let lastSlotIdx: number | null = null;

    const effortdone = this.a("effortdone",) as number | null;
    const effortleft = this.a("effortleft",) as number | null;
    const effort = this.a("effort",) as number;
    const length = this.a("length",) as number;
    const duration = this.a("duration",) as number;
    const slotDuration = project.get("scheduleGranularity",) as number;

    if (effortdone || effortleft) {
      // Force task to be scheduled in ASAP mode.
      task.forceForScenario("forward", true, scIdx,);
      if (!this.a("start",)) {
        this.error(
          "effort_done_left_start_missing",
          `Task ${task.fullId} has 'effortdone' or 'effortleft' ` +
            "attribute but no start date specified.",
        );
      }
      if (!(effort > 0)) {
        this.error(
          "effort_missing",
          `Task ${task.fullId} has 'effortdone' or 'effortleft' ` +
            "attribute but no 'effort'.",
        );
      }
      if (effortdone) {
        if (effortdone > effort) {
          this.error(
            "effort_done_larger_effort",
            `Task ${task.fullId} has larger 'effortdone' than 'effort'.`,
          );
        }
        this._doneEffort = effortdone;
        if (effortleft) {
          this.error(
            "effort_done_and_left",
            "A task cannot have the 'effortdone' and 'effortleft' attribute.",
          );
        }
      } else {
        if ((effortleft as number) > effort) {
          this.error(
            "effort_left_larger_effort",
            `Task ${task.fullId} has larger 'effortleft' than 'effort'.`,
          );
        }
        this._doneEffort = effort - (effortleft as number);
      }
      firstSlotIdx = project.dateToIdx(this.a("start",) as TjTime,);
      lastSlotIdx = project.dateToIdx(project.get("now",) as TjTime,);
    }

    const bookings = this.findBookings();
    if (bookings.length > 0) {
      if (effortdone || effortleft) {
        this.error(
          "bookings_and_effort",
          "Bookings cannot be used together with 'effortdone' or " +
            "'effortleft' attributes.",
        );
      }
      for (const booking of bookings) {
        const resource = booking.resource;
        if (!resource.leaf()) {
          this.error(
            "booking_resource_not_leaf",
            "Booked resources may not be group resources",
            booking.sourceFileInfo,
          );
        }
        if (!(this.a("forward",) as boolean) && !this._scheduled) {
          this.error(
            "booking_forward_only",
            "Only forward scheduled tasks may have booking statements.",
          );
        }
        let booked = false;
        for (const interval of booking.intervals) {
          // `false` = no clamp: a booking outside the project is an error, as in
          // Ruby.
          const startIdx = project.dateToIdx(interval.start, false,);
          const endIdx = project.dateToIdx(interval.end, false,);
          for (let idx = startIdx; idx <= endIdx - 1; idx++) {
            if (resource.scenarioData(scIdx,).bookBooking(idx, booking,)) {
              // Booking was successful for this time slot.
              this._doneEffort += resource.getForScenario(
                "efficiency",
                scIdx,
              ) as number;
              booked = true;

              // Store the indexes of the first slot and the slot after the
              // last slot.
              if (firstSlotIdx === null || firstSlotIdx > idx) {
                firstSlotIdx = idx;
              }
              if (lastSlotIdx === null || lastSlotIdx < idx) lastSlotIdx = idx;
            }
          }
        }
        if (booked) {
          const assigned = this.a("assignedresources",) as Resource[] | null;
          if (assigned && !assigned.includes(resource,)) {
            assigned.push(resource,);
          }
        }
      }
    }

    // For effort based tasks, or tasks without a start date, with bookings
    // that have not yet been marked as scheduled we set the start date to
    // the date of the first booked slot.
    const start = this.a("start",) as TjTime | null;
    if (
      (start === null || (this._doneEffort > 0 && effort > 0)) &&
      !this._scheduled && firstSlotIdx !== null
    ) {
      const firstSlotDate = project.idxToDate(firstSlotIdx,);
      if (start === null || firstSlotDate.compareTo(start,) > 0) {
        task.forceForScenario("start", firstSlotDate, scIdx,);
      }
    }

    // Check if the the duration criteria has already been reached by the
    // supplied bookings and set the task end to the last booked slot.
    // Also the task is marked as scheduled.
    if (lastSlotIdx !== null && !this._scheduled) {
      const tentativeEnd = project.idxToDate(lastSlotIdx + 1,);

      if (effort > 0) {
        if (this._doneEffort >= effort) {
          task.forceForScenario("end", tentativeEnd, scIdx,);
          this.markAsScheduled();
        }
      } else if (length > 0) {
        this._doneLength = 0;
        let date = this.a("start",) as TjTime;
        const startIdx = project.dateToIdx(date,);
        const endIdx = project.dateToIdx(project.get("now",) as TjTime,);
        for (let idx = startIdx; idx <= endIdx; idx++) {
          if (this.onShift(idx,)) this._doneLength += 1;
          date = date.addSeconds(slotDuration,);
          // Continue not only until the `length` has been reached, but also
          // the tentativeEnd date. This allows us to detect overbookings.
          if (
            this._doneLength >= length && date.compareTo(tentativeEnd,) >= 0
          ) {
            const endDate = project.idxToDate(idx + 1,);
            task.forceForScenario(
              "end",
              endDate.compareTo(tentativeEnd,) > 0 ? endDate : tentativeEnd,
              scIdx,
            );
            this.markAsScheduled();
            break;
          }
        }
      } else if (duration > 0) {
        this._doneDuration = Math.trunc(
          tentativeEnd.diff(this.a("start",) as TjTime,) / slotDuration,
        );
        if (this._doneDuration >= duration) {
          task.forceForScenario("end", tentativeEnd, scIdx,);
          this.markAsScheduled();
        } else if (
          duration * slotDuration <
            (project.get("now",) as TjTime).diff(this.a("start",) as TjTime,)
        ) {
          // This handles the case where the bookings don't provide enough
          // doneDuration to reach the duration, but the now date would be
          // after the start + duration date.
          task.forceForScenario(
            "end",
            (this.a("start",) as TjTime).addSeconds(duration * slotDuration,),
            scIdx,
          );
          this.markAsScheduled();
        }
      }
    }

    // If the task has bookings, we assume that the bookings describe all
    // work up to the 'now' date.
    if (this._doneEffort > 0) {
      this._currentSlotIdx = project.dateToIdx(project.get("now",) as TjTime,);
    }

    // Finally, we check if the bookings caused more effort, length or
    // duration than was requested by the user. This is only flagged as a
    // warning.
    const dailyWorkingHours = project.get("dailyworkinghours",) as number;
    if (effort > 0) {
      const effortDays = project.slotsToDays(this._doneEffort,);
      const effortHours = effortDays * dailyWorkingHours;
      const requestedEffort = project.slotsToDays(effort,);
      const requestedEffortHours = requestedEffort * dailyWorkingHours;
      if (effortDays > requestedEffort) {
        this.warning(
          "overbooked_effort",
          `The total effort (${effortDays}d or ${effortHours}h) of the ` +
            `provided bookings for task ${task.fullId} exceeds the specified ` +
            `effort of ${requestedEffort}d or ${requestedEffortHours}h.`,
        );
      }
    }
    if (length > 0 && this._doneLength > length) {
      const lengthDays = project.slotsToDays(this._doneLength,);
      const requestedLength = project.slotsToDays(length,);
      this.warning(
        "overbooked_length",
        `The total length (${lengthDays}d) of the provided bookings for task ` +
          `${task.fullId} exceeds the specified length of ` +
          `${requestedLength}d.`,
      );
    }
    if (duration > 0 && this._doneDuration > duration) {
      const durationDays = this._doneDuration * slotDuration / (60.0 * 60 * 24);
      const requestedDuration = duration * slotDuration / (60.0 * 60 * 24);
      this.warning(
        "overbooked_duration",
        `The total duration (${durationDays}d) of the provided bookings for ` +
          `task ${task.fullId} exceeds the specified duration of ` +
          `${requestedDuration}d.`,
      );
    }

    // If a task has only bookings but no effort, length or duration and is
    // not a milestone but marked as being scheduled, we set the start and
    // end date according to the first/last booking date unless the date has
    // been set already.
    if (
      this._scheduled && effort === 0 && length === 0 && duration === 0 &&
      !(this.a("milestone",) as boolean)
    ) {
      if (!this.a("start",) && firstSlotIdx !== null) {
        task.forceForScenario(
          "start",
          project.idxToDate(firstSlotIdx,),
          scIdx,
        );
      }
      if (!this.a("end",) && lastSlotIdx !== null) {
        task.forceForScenario(
          "end",
          project.idxToDate(lastSlotIdx + 1,),
          scIdx,
        );
      }
    }
  }

  /**
   * Effective bookings of the scenario, inherited from the parent scenario
   * while `ownbookings` is false (the top scenario never inherits).
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:findBookings
   */
  private findBookings(): Booking[] {
    // Reconciles the `scenario()` signature (the `ProjectLike` one returns only
    // `{ id, fullId }`) with the `Scenario` node that carries
    // `ownbookings`/`parent`.
    const project = this.project() as unknown as {
      scenario(idx: number,): {
        readonly fullId: string;
        readonly parent: unknown;
        get(name: string,): unknown;
      } | null;
      scenarioIdx(sc: string,): number | undefined;
    };
    let scenario = project.scenario(this.getScenarioIdx(),);
    if (!scenario) return [];
    // Check if the current scenario should inherit its bookings from the
    // parent. If so, redirect 'scenario' to the parent.
    while (!scenario.get("ownbookings",)) {
      const parent = scenario.parent;
      if (!parent) break;
      scenario = parent as typeof scenario;
    }
    const scIdx = project.scenarioIdx(scenario.fullId,);
    if (scIdx === undefined) return [];
    return ((this.getProperty() as Task).getForScenario("booking", scIdx,) ??
      []) as Booking[];
  }

  /**
   * Resets the deadEndFlags to [false, false, false, false].
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:resetLoopFlags
   */
  resetLoopFlags(): void {
    this._deadEndFlags = [false, false, false, false,];
  }

  /**
   * Checks whether the task has dependencies on a given end.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:hasDependencies
   */
  hasDependencies(atEnd: boolean,): boolean {
    const list = atEnd ? this._endsuccs : this._startpreds;
    return list.length > 0;
  }

  /**
   * Checks whether the task has strong dependencies on a given end.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:hasStrongDeps?
   */
  hasStrongDeps(atEnd: boolean,): boolean {
    if (atEnd) {
      return this._endsuccs.length > 0;
    }
    return this._startpreds.length > 0;
  }

  /**
   * Marks the task as runaway (outside the project interval).
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:markAsRunaway
   */
  markAsRunaway(): void {
    this._isRunAway = true;
    const project = this.project();
    const granularity = (project.get("scheduleGranularity",) as number) ?? 3600;
    const dailyWorkingHours = (project.get("dailyWorkingHours",) as number) ??
      8;
    const remainingEffort =
      (granularity * (this.a("effort",) as number - this._doneEffort)) /
      (dailyWorkingHours * 3600);
    this.warning(
      "runaway",
      `${remainingEffort}d of effort of task ${
        (this.getProperty() as Task).fullId
      } does not fit into the project time frame.`,
    );
    const competitors = this.a("competitors",) as Task[];
    if (competitors && competitors.length > 0) {
      this.warning(
        "runaway_competitor",
        `Task ${
          (this.getProperty() as Task).fullId
        } has competitors for the same resources.`,
      );
    }
  }

  /**
   * Checks whether the task is ready to be scheduled.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:readyForScheduling?
   */
  readyForScheduling(): boolean {
    if (this._scheduled) return true;
    if (this._isRunAway) return false;
    const forward = this.a("forward",) as boolean;
    const start = this.a("start",) as TjTime;
    const end = this.a("end",) as TjTime;
    if (forward) {
      return !!(start && (this._hasDurationSpec || end));
    } else {
      return !!(end && (this._hasDurationSpec || start));
    }
  }

  /**
   * Runs consistency checks before scheduling.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:preScheduleCheck
   */
  preScheduleCheck(): void {
    // Ruby: `@chargeset.each do |chargeset| chargeset.each do |account, share|`.
    // In the port, `chargeset` is `ChargeSet[]` (ChargeSetListAttribute) and each
    // `ChargeSet` exposes `.each(cb)` over an internal `Map<Account, number>`.
    const chargeset = this.a("chargeset",) as {
      each(fn: (account: Account, share: number | null,) => void,): void;
    }[];
    if (chargeset) {
      for (const chargesetItem of chargeset) {
        chargesetItem.each((account, _share,) => {
          if (account && !account.leaf?.()) {
            this.error(
              "account_no_leaf",
              `Chargesets may not include group account ${account.fullId}.`,
            );
          }
        },);
      }
    }

    const responsible = this.a("responsible",) as string[];
    if (responsible) {
      const convertedResponsible = [];
      for (const resourceId of responsible) {
        const resource = this.project().resource(resourceId,);
        if (!resource) {
          this.error(
            "resource_id_expected",
            `${resourceId} is not a defined resource.`,
          );
        } else {
          convertedResponsible.push(resource,);
        }
      }
      (this.getProperty() as Task).setForScenario(
        "responsible",
        convertedResponsible,
        this.getScenarioIdx(),
      );
    }

    const booking = this.a("booking",) as unknown[];
    if (booking.length > 0 && (this.getProperty() as Task).container?.()) {
      this.error(
        "container_booking",
        `Container task ${
          (this.getProperty() as Task).fullId
        } may not have bookings.`,
      );
    }

    const milestone = this.a("milestone",) as boolean;
    if (milestone && booking.length > 0) {
      this.error(
        "milestone_booking",
        `Milestone ${
          (this.getProperty() as Task).fullId
        } may not have bookings.`,
      );
    }

    if (this._scheduled && (!this.a("start",) || !this.a("end",))) {
      this.error(
        "not_scheduled",
        `Task ${
          (this.getProperty() as Task).fullId
        } is marked as scheduled but does not have a fixed start and end date.`,
      );
    }

    const effort = this.a("effort",) as number;
    const allocate = this.a("allocate",) as Allocation[];
    if (effort > 0 && (!allocate || allocate.length === 0)) {
      this.error(
        "effort_no_allocations",
        `Task ${
          (this.getProperty() as Task).fullId
        } has an effort but no resource allocations.`,
      );
    }

    let durationSpecs = 0;
    if (effort > 0) durationSpecs++;
    if ((this.a("length",) as number) > 0) durationSpecs++;
    if ((this.a("duration",) as number) > 0) durationSpecs++;
    if (milestone) durationSpecs++;

    if ((this.getProperty() as Task).container?.() && durationSpecs > 0) {
      this.error(
        "container_duration",
        `Container task ${
          (this.getProperty() as Task).fullId
        } may not have a duration or be marked as milestones.`,
      );
    }

    if (milestone && durationSpecs > 1) {
      this.error(
        "milestone_duration",
        `Milestone ${
          (this.getProperty() as Task).fullId
        } may not have a duration.`,
      );
    }

    if (
      milestone && this.a("start",) && this.a("end",) &&
      (this.a("start",) as TjTime).toSeconds() !==
        (this.a("end",) as TjTime).toSeconds()
    ) {
      this.error(
        "milestone_start_end",
        `Start (${(this.a("start",) as TjTime).toString()}) and end (${
          (this.a("end",) as TjTime).toString()
        }) dates of milestone task ${
          (this.getProperty() as Task).fullId
        } must be identical.`,
      );
    }

    const forward = this.a("forward",) as boolean;
    const hasDependenciesStart = this.hasDependencies(false,);
    const hasDependenciesEnd = this.hasDependencies(true,);

    if (!milestone && !((this.getProperty() as Task).container?.())) {
      if (
        durationSpecs === 0 &&
        ((forward && !this.a("end",) && !hasDependenciesEnd) ||
          (!forward && !this.a("start",) && !hasDependenciesStart))
      ) {
        this.error(
          "task_underspecified",
          `Task ${
            (this.getProperty() as Task).fullId
          } has too few specifications to be scheduled.`,
        );
      }

      if (durationSpecs > 1) {
        this.error(
          "multiple_durations",
          `Tasks may only have either a duration, length or effort or be a milestone.`,
        );
      }

      const startSpeced = (this.getProperty() as Task).provided(
        "start",
        this.getScenarioIdx(),
      );
      const endSpeced = (this.getProperty() as Task).provided(
        "end",
        this.getScenarioIdx(),
      );
      if (
        ((startSpeced && endSpeced) ||
          (hasDependenciesStart && forward && endSpeced) ||
          (hasDependenciesEnd && !forward && startSpeced)) &&
        durationSpecs > 0 &&
        !(this.getProperty() as Task).provided(
          "scheduled",
          this.getScenarioIdx(),
        )
      ) {
        this.error(
          "task_overspecified",
          `Task ${
            (this.getProperty() as Task).fullId
          } has a start, an end and a duration specification.`,
        );
      }
    }

    if (
      !forward && booking && booking.length > 0 && !this._scheduled
    ) {
      this.error(
        "alap_booking",
        "A task scheduled in ALAP mode may only have bookings if it has been marked as fully scheduled.",
      );
    }

    const scIdx = this.getScenarioIdx();
    for (const [task, onEnd,] of this._startsuccs) {
      if (task && !task.scenarioData(scIdx,).a("forward",)) {
        task.scenarioData(scIdx,).error(
          "onstart_wrong_direction",
          "Tasks with on-start dependencies must be ASAP scheduled",
        );
      }
    }

    for (const [task, onEnd,] of this._endpreds) {
      if (task && task.scenarioData(scIdx,).a("forward",)) {
        task.scenarioData(scIdx,).error(
          "onend_wrong_direction",
          "Tasks with on-end dependencies must be ALAP scheduled",
        );
      }
    }
  }

  /**
   * Checks for dependency loops.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:checkForLoops
   */
  checkForLoops(
    path: [Task, boolean,][],
    atEnd: boolean,
    fromOutside: boolean,
    forward: boolean,
  ): void {
    // RUBY-COMPAT-FIX: Ruby's `path.include?([@property, atEnd])` compares
    // **structurally** (`Array#==`); JS `Array#includes` compares by reference
    // and a freshly created tuple is never `===` to the one in `path`, so the
    // loop was never detected and the port died silently (exit 1 with no
    // message). CLI golden (24.7): `tj3` emits `loop_detected` + `Aborting`.
    if (
      path.some(([task, end,],) => task === this.getProperty() && end === atEnd)
    ) {
      this.warning(
        "loop_detected",
        `Dependency loop detected at ${atEnd ? "end" : "start"} of task ${
          (this.getProperty() as Task).fullId
        }`,
      );
      let skip = true;
      for (const [t, e,] of path) {
        if (t === (this.getProperty() as Task) && e === atEnd) {
          skip = false;
          continue;
        }
        if (!skip) {
          this.info(
            `loop_at_${e ? "end" : "start"}`,
            // `ctnd.` is Ruby's text (`TaskScenario.rb:642`), abbreviated there.
            `Loop ctnd. at ${e ? "end" : "start"} of task ${t.fullId}`,
            t.sourceFileInfo as unknown as SourceFileInfo | null,
          );
        }
      }
      this.error("loop_end", "Aborting",);
      return;
    }

    if (this._deadEndFlags[(atEnd ? 2 : 0) + (fromOutside ? 1 : 0)]) {
      return;
    }

    path.push([this.getProperty() as Task, atEnd,],);

    if (!atEnd) {
      if (fromOutside) {
        if ((this.getProperty() as Task).container?.()) {
          for (const child of (this.getProperty() as Task).children) {
            (child as Task).scenarioData(this.getScenarioIdx(),).checkForLoops(
              path,
              false,
              true,
              forward,
            );
          }
        } else {
          if ((forward && this.a("forward",)) || this.a("milestone",)) {
            this.checkForLoops(path, true, false, true,);
          }
        }
      } else {
        if (
          this._startpreds.length === 0 &&
          (this.getProperty() as Task).parent
        ) {
          const parent = (this.getProperty() as Task).parent as Task;
          parent.scenarioData(
            this.getScenarioIdx(),
          ).checkForLoops(path, false, false, forward,);
        } else {
          for (const [task, targetEnd,] of this._startpreds) {
            if (task) {
              (task as Task).scenarioData(this.getScenarioIdx(),).checkForLoops(
                path,
                targetEnd,
                true,
                forward,
              );
            }
          }
        }
      }
    } else {
      if (fromOutside) {
        if ((this.getProperty() as Task).container?.()) {
          for (const child of (this.getProperty() as Task).children) {
            (child as Task).scenarioData(this.getScenarioIdx(),).checkForLoops(
              path,
              true,
              true,
              forward,
            );
          }
        } else {
          if ((!forward && !this.a("forward",)) || this.a("milestone",)) {
            this.checkForLoops(path, false, false, false,);
          }
        }
      } else {
        if (
          this._endsuccs.length === 0 &&
          (this.getProperty() as Task).parent
        ) {
          const parent = (this.getProperty() as Task).parent as Task;
          parent.scenarioData(
            this.getScenarioIdx(),
          ).checkForLoops(path, true, false, forward,);
        } else {
          for (const [task, targetEnd,] of this._endsuccs) {
            if (task) {
              (task as Task).scenarioData(this.getScenarioIdx(),).checkForLoops(
                path,
                targetEnd,
                true,
                forward,
              );
            }
          }
        }
      }
    }

    path.pop();
    this._deadEndFlags[(atEnd ? 2 : 0) + (fromOutside ? 1 : 0)] = true;
  }

  /**
   * Computes the criticalness of the task.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:calcCriticalness
   */
  calcCriticalness(): void {
    this._criticalness = 0.0;
    this._pathcriticalness = null;

    if (this.a("milestone",)) {
      this._criticalness = (this.a("priority",) as number) / 500.0;
      return;
    }

    if (
      (this.a("effort",) as number) <= 0 || !this._candidates ||
      this._candidates.length === 0
    ) {
      return;
    }

    let criticalness = 0.0;
    for (const resource of this._candidates) {
      criticalness += resource.scenarioData(this.getScenarioIdx(),).a(
        "criticalness",
      ) as number;
    }
    criticalness /= this._candidates.length;

    this._criticalness = (this.a("effort",) as number) * criticalness;
  }

  /**
   * Computes the path criticalness.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:calcPathCriticalness
   */
  calcPathCriticalness(atEnd: boolean = false,): number {
    if (this._pathcriticalness !== null) {
      return this._pathcriticalness - (atEnd ? 0 : this._criticalness);
    }

    let maxCriticalness = 0.0;

    if (atEnd) {
      const criticalness = this.calcPathCriticalnessEndSuccs();
      if (criticalness > maxCriticalness) {
        maxCriticalness = criticalness;
      }
    } else {
      if ((this.getProperty() as Task).container?.()) {
        for (const task of (this.getProperty() as Task).children) {
          const criticalness = (task as Task).scenarioData(
            this.getScenarioIdx(),
          ).calcPathCriticalness(false,);
          if (criticalness > maxCriticalness) {
            maxCriticalness = criticalness;
          }
        }
      } else {
        for (const [task, onEnd,] of this._startsuccs) {
          if (task) {
            const criticalness = (task as Task).scenarioData(
              this.getScenarioIdx(),
            ) as TaskScenario;
            const pathCrit = criticalness.calcPathCriticalness(onEnd,);
            if (pathCrit > maxCriticalness) {
              maxCriticalness = pathCrit;
            }
          }
        }

        const criticalness = this.calcPathCriticalnessEndSuccs();
        if (criticalness > maxCriticalness) {
          maxCriticalness = criticalness;
        }

        maxCriticalness += this._criticalness;
      }
    }

    this._pathcriticalness = maxCriticalness;
    return maxCriticalness;
  }

  /**
   * Computes the path criticalness for the end successors.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:calcPathCriticalnessEndSuccs
   */
  calcPathCriticalnessEndSuccs(): number {
    let maxCriticalness = 0.0;

    if ((this.getProperty() as Task).container?.()) {
      for (const task of (this.getProperty() as Task).children) {
        const criticalness = (task as Task).scenarioData(
          this.getScenarioIdx(),
        ) as TaskScenario;
        const pathCrit = criticalness.calcPathCriticalnessEndSuccs();
        if (pathCrit > maxCriticalness) {
          maxCriticalness = pathCrit;
        }
      }
    } else {
      for (const [task, onEnd,] of this._endsuccs) {
        if (task) {
          const criticalness = (task as Task).scenarioData(
            this.getScenarioIdx(),
          ) as TaskScenario;
          const pathCrit = criticalness.calcPathCriticalnessEndSuccs();
          if (pathCrit > maxCriticalness) {
            maxCriticalness = pathCrit;
          }
        }
      }
    }

    return maxCriticalness;
  }

  /**
   * Compute the turnover (cost or revenue) for this task.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:turnover
   */
  turnover(
    startIdx: number,
    endIdx: number,
    account: Account,
    resource: Resource | null = null,
    includeKids: boolean = true,
  ): number {
    let amount = 0.0;
    if ((this.getProperty() as Task).container?.() && includeKids) {
      for (const child of (this.getProperty() as Task).kids()) {
        amount += (child as Task).scenarioData(this.getScenarioIdx(),).turnover(
          startIdx,
          endIdx,
          account,
          resource,
        );
      }
    }
    // If we are evaluating the task in the context of a specific resource,
    // we use the chargeset of that resource, not the chargeset of the task.
    const chargeset = resource
      ? (resource.scenarioData(this.getScenarioIdx(),) as ResourceScenario).a(
        "chargeset",
      ) as ChargeSet[]
      : this.a("chargeset",) as ChargeSet[];

    // If there are no chargeset defined for this task, we don't need to
    // compute the resource related or other cost.
    if (chargeset && chargeset.length > 0) {
      let resourceCost = 0.0;
      let otherCost = 0.0;

      // Container tasks don't have resource cost.
      if (!(this.getProperty() as Task).container?.()) {
        if (resource) {
          resourceCost = (resource.scenarioData(
            this.getScenarioIdx(),
          ) as ResourceScenario).cost(
            startIdx,
            endIdx,
            this.getProperty() as Task,
          );
        } else {
          for (
            const assignedResource of this.a(
              "assignedresources",
            ) as Resource[]
          ) {
            resourceCost += (assignedResource.scenarioData(
              this.getScenarioIdx(),
            ) as ResourceScenario).cost(startIdx, endIdx,);
          }
        }
      }

      const charge = this.a("charge",) as Charge[];
      if (charge && charge.length > 0) {
        // Add one-time and periodic charges to the amount.
        const iv = new TimeInterval(
          this.project().idxToDate(startIdx,),
          this.project().idxToDate(endIdx,),
        );
        for (const chargeItem of charge) {
          otherCost += chargeItem.turnover(iv,);
        }
      }

      const totalCost = resourceCost + otherCost;
      // Now weight the total cost by the share of the account
      for (const chargesetItem of chargeset as ChargeSet[]) {
        chargesetItem.each((accnt, share,) => {
          if (
            share !== null &&
            share > 0.0 && (accnt === account || accnt.isChildOf?.(account,))
          ) {
            amount += totalCost * share;
          }
        },);
      }
    }

    return amount;
  }

  /**
   * Counts the resource allocations and adds the average effort to each
   * resource.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:countResourceAllocations
   */
  countResourceAllocations(): void {
    if (
      !this._candidates || this._candidates.length === 0 ||
      (this.a("effort",) as number) <= 0
    ) {
      return;
    }

    const avgEffort = (this.a("effort",) as number) / this._candidates.length;
    for (const resource of this._candidates) {
      const current = resource.getForScenario(
        "alloctdeffort",
        this.getScenarioIdx(),
      ) as number;
      resource.setForScenario(
        "alloctdeffort",
        current + avgEffort,
        this.getScenarioIdx(),
      );
    }
  }

  /**
   * Returns the list of candidate (leaf) resources allocated to this task.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:candidates
   */
  candidates(): Resource[] {
    if (this._candidates.length > 0) {
      return this._candidates;
    }

    const allocate = this.a("allocate",) as Allocation[];
    if (!allocate) {
      return [];
    }

    const candidates: Resource[] = [];
    for (const allocation of allocate) {
      for (
        const candidate of allocation.candidatesList(this.getScenarioIdx(),)
      ) {
        if (!candidates.includes(candidate,)) {
          candidates.push(candidate,);
        }
      }
    }

    this._candidates = candidates;
    return candidates;
  }

  /**
   * Which attribute decides the task's duration.
   *
   * One of `effortTask`, `lengthTask`, `durationTask` or `startEndTask`, fixed
   * by `prepareScheduling()` and read by the scheduler and the reports.
   */
  durationType(): string {
    return this._durationType;
  }

  /**
   * Whether the task is allowed to run in the scoreboard slot `sbIdx`.
   *
   * Falls back to the project working calendar when the task has no shift
   * assignments of its own.
   */
  onShift(sbIdx: number,): boolean {
    const shifts = this._shifts;
    if (shifts && shifts.assigned?.(sbIdx,)) {
      return shifts.onShift?.(sbIdx,);
    } else {
      return this.project().isWorkingTime(sbIdx,);
    }
  }

  /** `true` when the task declared `duration`, `length` or `effort`. */
  hasDurationSpec(): boolean {
    return this._hasDurationSpec;
  }

  /** Project this task belongs to (structural view used by scheduling). */
  project(): ProjectLike {
    return (this.getProperty() as Task).project as ProjectLike;
  }

  /** The owning task, narrowed from {@link ScenarioData}. */
  override getProperty(): Task {
    return super.getProperty() as Task;
  }

  /** Index of the scenario this state belongs to. */
  override getScenarioIdx(): number {
    return this.scenarioIdx;
  }

  /**
   * True when `resource` is allocated to this task (or to any child) in the
   * given interval. Proxy of `PropertyTreeNode` → `Resource#allocated?` as in
   * Ruby (the call in the kids loop uses the child proxy).
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:hasResourceAllocated?
   */
  hasResourceAllocated(interval: TimeInterval, resource: Resource,): boolean {
    const assigned = (this.a("assignedresources",) as Resource[]) ?? [];
    if (!assigned.includes(resource,)) return false;

    const task = this.getProperty();
    if (task.leaf()) {
      return resource.allocated(this.scenarioIdx, interval, task,);
    }
    for (const kid of task.kids()) {
      const kidSc = (kid as Task).scenarioData(this.scenarioIdx,);
      if (kidSc.hasResourceAllocated(interval, resource,)) return true;
    }
    return false;
  }

  /** Reads a scenario attribute through the property bag. */
  override a(attr: string,): unknown {
    return super.a(attr,);
  }

  /** `true` when the task is flagged as a milestone. */
  milestone(): boolean {
    return this.a("milestone",) as boolean;
  }

  /** Effort already consumed by the scheduler (not the user's `effortdone`). */
  getEffectiveWork(): number {
    return this._doneEffort;
  }

  /**
   * Total time (in days) allocated by the resources assigned to this task
   * between `startIdx` and `endIdx`. With `resource`, only that resource's
   * allocation counts; containers sum the children (faithful to Ruby).
   *
   * Faithful port of `TaskScenario.rb#getAllocatedTime` (1562–1588). Ruby
   * caches it via `@dCache.cached(self, :TaskScenarioAllocatedTime, ...)`; this
   * port omits the cache in line with `ResourceScenario.getAllocatedTime`
   * (resource-scenario.ts:592 — whose `treeSum` carries only the nominal
   * `cacheTag`): the `DataCache` flush is still a stub in this project
   * (`project.ts:508`), so there is no invalidation point for the values.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb#getAllocatedTime
   */
  getAllocatedTime(
    startIdx: number,
    endIdx: number,
    resource: Resource | null = null,
  ): number {
    const task = this.getProperty() as Task;
    const assigned = (this.a("assignedresources",) as Resource[]) ?? [];
    // Normalises proxy → real node (same guard as ResourceScenario#
    // getEffectiveWork:549-552).
    const res = (resource ? (resource.ptn?.() ?? resource) : null) as
      | Resource
      | null;
    if (
      this.milestone() || startIdx >= endIdx ||
      (res !== null && !assigned.some((r,) => (r.ptn?.() ?? r) === res))
    ) {
      return 0.0;
    }
    const scIdx = this.getScenarioIdx();
    let allocatedTime = 0.0;
    if (task.container()) {
      // Ruby: task.getAllocatedTime(@scenarioIdx, startIdx, endIdx, resource)
      // — here the child Task exposes its TaskScenario directly. Filter by
      // class (review (e)): `kids()` is typed as PropertyTreeNode[]; a non-Task
      // child should never exist, but a blind cast explodes on the first
      // exception — ignoring non-tasks is the safe behaviour.
      for (const kid of task.kids()) {
        if (!(kid instanceof Task)) continue;
        allocatedTime += kid.scenarioData(scIdx,).getAllocatedTime(
          startIdx,
          endIdx,
          res,
        );
      }
    } else if (res !== null) {
      allocatedTime += res.scenarioData(scIdx,).getAllocatedTime(
        startIdx,
        endIdx,
        task,
      );
    } else {
      for (const r of assigned) {
        const real = (r.ptn?.() ?? r) as Resource;
        allocatedTime += real.scenarioData(scIdx,).getAllocatedTime(
          startIdx,
          endIdx,
          task,
        );
      }
    }
    return allocatedTime;
  }

  /** `true` once the scheduler marked the task as running away. */
  isRunAway(): boolean {
    return this._isRunAway;
  }

  /** Marks the task as run away, so scheduling stops trying to fit it. */
  runAway(): void {
    this._isRunAway = true;
  }

  /** `true` when this task appears in the `depends`/`precedes` of `task`. */
  isDependencyOf(task: Task,): boolean {
    const scIdx = this.getScenarioIdx();
    const depends = task.scenarioData(scIdx,).a("depends",) as TaskDependency[];
    if (depends) {
      for (const dep of depends) {
        if (dep.task === this.getProperty()) return true;
      }
    }
    const precedes = task.scenarioData(scIdx,).a(
      "precedes",
    ) as TaskDependency[];
    if (precedes) {
      for (const dep of precedes) {
        if (dep.task === this.getProperty()) return true;
      }
    }
    return false;
  }

  /**
   * Shift assignments for this task in `scIdx`.
   *
   * Returns a fresh, empty {@link ShiftAssignments} when the task declares
   * shifts at all, and `null` when it does not.
   */
  shiftAssignments(scIdx: number,): ShiftAssignments | null {
    const shifts = this.a("shifts",) as ShiftAssignments[];
    if (!shifts || shifts.length === 0) return null;
    return new ShiftAssignments();
  }

  /** `true` when the task declares at least one `shifts` entry. */
  shifts(): boolean {
    const shifts = this.a("shifts",) as ShiftAssignments[];
    return !!(shifts && shifts.length > 0);
  }

  /** Tasks this one depends on, with the flag telling which end is tied. */
  startpreds(): [Task | null, boolean,][] {
    return this._startpreds;
  }

  /** Tasks that depend on this one through its start end. */
  startsuccs(): [Task | null, boolean,][] {
    return this._startsuccs;
  }

  /** Tasks this one depends on through its end end. */
  endpreds(): [Task | null, boolean,][] {
    return this._endpreds;
  }

  /** Tasks that depend on this one through its end end. */
  endsuccs(): [Task | null, boolean,][] {
    return this._endsuccs;
  }

  /** `true` when the task is scheduled forward from its start. */
  forward(): boolean {
    return this.a("forward",) as boolean;
  }

  /** Slot currently being reserved by the scheduler, or `null` before one. */
  currentSlotIdx(): number | null {
    return this._currentSlotIdx;
  }

  /** Duration already elapsed, in working units. */
  doneDuration(): number {
    return this._doneDuration;
  }

  /** Length already elapsed, in calendar units. */
  doneLength(): number {
    return this._doneLength;
  }

  /**
   * Effort already completed by the scheduler (one unit per reserved slot, with
   * the resource efficiency). Ruby uses the instance variable `@doneEffort`
   * (TaskScenario.rb:1761-1762, 1944), NOT the `effortdone` attribute — which is
   * user input through tracking cuts (TaskScenario.rb:2020-2026). Reading
   * `a("effortdone")` always returned 0 and prevented effortTasks from
   * finishing (they never propagated `end`).
   */
  doneEffort(): number {
    return this._doneEffort;
  }

  /** Index of the `now` slot cached for this scheduling pass. */
  nowIdx(): number {
    return this._nowIdx;
  }

  /** `true`/`false` once the start was decided, `null` while unknown. */
  startIsDetermed(): boolean | null {
    return this._startIsDetermed;
  }

  /** `true`/`false` once the end was decided, `null` while unknown. */
  endIsDetermed(): boolean | null {
    return this._endIsDetermed;
  }

  /** `true` once the start date has been propagated to dependencies. */
  startPropagated(): boolean {
    return this._startPropagated;
  }

  /** `true` once the end date has been propagated to dependencies. */
  endPropagated(): boolean {
    return this._endPropagated;
  }

  /** Limits attached to this task in this scenario. */
  allLimits(): unknown[] {
    return this._allLimits;
  }

  /**
   * Increment all limits for the given scoreboard index.
   * Limits do not take efficiency into account. Limits are usage limits, not
   * effort limits.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:incLimits
   */
  incLimits(sbIdx: number, resource?: Resource,): void {
    for (const limit of this._allLimits) {
      (limit as Limits).inc(sbIdx, resource,);
    }
  }

  /** Contention map: resource → number of slots it is fought over. */
  contendedResources(): Map<Task, Map<Resource, number>> {
    return this._contendedResources;
  }

  /** Mandatory allocations (the ones that cannot be substituted). */
  mandatories(): Allocation[] {
    return this._mandatories;
  }

  /**
   * Dead-end flags for the start and end, in both directions.
   *
   * Index order is `[start-fwd, start-bwd, end-fwd, end-bwd]`; the scheduler
   * sets them while looking for a slot that does not violate a constraint.
   */
  deadEndFlags(): boolean[] {
    return this._deadEndFlags;
  }

  /** Criticalness of this task within its dependency graph. */
  criticalness(): number {
    return this._criticalness;
  }

  /** Criticalness along the whole path to the project end, or `null`. */
  pathcriticalness(): number | null {
    return this._pathcriticalness;
  }

  /** Completion ratio in percent, or `null` before it was calculated. */
  complete(): number | null {
    return this._complete;
  }

  /** Computed status symbol (`BLOCKED`, `WAITING`, …) or `""` before one. */
  status(): string {
    return this._status;
  }

  /** Gauge symbol (`green`, `yellow`, `red`, …) or `null` when unset. */
  gauge(): string | null {
    return this._gauge;
  }

  /**
   * Reports an error through the handler and bumps the per-scenario counter.
   *
   * @param id Stable message id.
   * @param text Human-readable description.
   * @param sfi Source location or file name, when known.
   * @param property Property the message belongs to, when known.
   */
  override error(
    id: string,
    text: string,
    sfi?: string | SourceFileInfo | null,
    property?: PropertyLike,
  ): void {
    super.error(id, text, sfi, property,);
    this._errors++;
  }

  /** Number of errors recorded against this task in this scenario. */
  errors(): number {
    return this._errors;
  }

  /**
   * Core scheduling algorithm entry point. Schedules the task to completion.
   * Returns true if a start or end date has been determined and other tasks
   * may be ready for scheduling now.
   */
  schedule(): boolean {
    // Check if the task has already been scheduled e.g. by propagateDate()
    if (this._scheduled) return true;

    // RUBY-COMPAT-FIX: `prepareScheduling` runs **once** per scenario, in
    // `Project#prepareScenario` (Project.rb:1096) — `TaskScenario#schedule`
    // (TaskScenario.rb:931) does not call it. Calling it here cleared the
    // `startsuccs`/`endsuccs` lists already resolved by the task `Xref`, and the
    // Gantt lost the dependencies that leave it (missing arrows).

    // Compute the date of the next slot this task wants to have scheduled.
    if (this.forward()) {
      if (this.currentSlotIdx() === null) {
        const project = this.project();
        const start = this.a("start",) as TjTime;
        const now = project.get("now",) as TjTime;
        const projectionmode = this.a("projectionmode",) as boolean;
        const allocate = this.a("allocate",) as Allocation[];

        this._currentSlotIdx = project.dateToIdx(
          projectionmode && (now.toSeconds() > start.toSeconds()) &&
            allocate?.length > 0
            ? now
            : start,
        );
      }
    } else {
      if (this.currentSlotIdx() === null) {
        const project = this.project();
        const end = this.a("end",) as TjTime;
        this._currentSlotIdx = project.dateToIdx(end,) - 1;
      }
    }

    // Schedule all time slots from slot in the scheduling direction until
    // the task is completed or a problem has been found.
    const project = this.project();
    const lowerLimit = project.dateToIdx(project.get("start",) as TjTime,);
    const upperLimit = project.dateToIdx(project.get("end",) as TjTime,);
    const delta = this.forward() ? 1 : -1;

    while (this.scheduleSlot()) {
      if (this._currentSlotIdx === null) {
        this.markAsRunaway();
        return false;
      }
      this._currentSlotIdx += delta;
      if (
        this._currentSlotIdx < lowerLimit ||
        upperLimit < this._currentSlotIdx
      ) {
        this.markAsRunaway();
        return false;
      }
    }

    return true;
  }

  /**
   * Schedule a single slot. Returns false if the task has been completely scheduled.
   */
  scheduleSlot(): boolean {
    // Ruby never calls `scheduleSlot` on an already scheduled task: `schedule`
    // returns earlier (`TaskScenario.rb:932`). The guard exists for direct calls
    // (APIs/tests) and avoids operating with a null `currentSlotIdx`.
    if (this._scheduled) return false;
    switch (this.durationType()) {
      case "effortTask":
        this.bookResources();
        if (this.doneEffort() >= (this.a("effort",) as number)) {
          if (this.forward()) {
            this.propagateDate(
              this.project().idxToDate((this.currentSlotIdx() as number) + 1,),
              true,
              true,
            );
          } else {
            this.propagateDate(
              this.project().idxToDate(this.currentSlotIdx() as number,),
              false,
              true,
            );
          }
          return false;
        }
        break;

      case "lengthTask":
        this.bookResources();
        if (this.onShift(this.currentSlotIdx() as number,)) {
          this._doneLength += 1;
        }
        if (this._doneLength >= (this.a("length",) as number)) {
          if (this.forward()) {
            this.propagateDate(
              this.project().idxToDate((this.currentSlotIdx() as number) + 1,),
              true,
              true,
            );
          } else {
            this.propagateDate(
              this.project().idxToDate(this.currentSlotIdx() as number,),
              false,
              true,
            );
          }
          return false;
        }
        break;

      case "durationTask":
        this.bookResources();
        this._doneDuration += 1;
        if (this._doneDuration >= (this.a("duration",) as number)) {
          if (this.forward()) {
            this.propagateDate(
              this.project().idxToDate((this.currentSlotIdx() as number) + 1,),
              true,
              true,
            );
          } else {
            this.propagateDate(
              this.project().idxToDate(this.currentSlotIdx() as number,),
              false,
              true,
            );
          }
          return false;
        }
        break;

      case "startEndTask":
        this.bookResources();
        if (
          (this.forward() &&
            (this.currentSlotIdx() as number) >= (this._endIdx as number)) ||
          (!this.forward() &&
            (this.currentSlotIdx() as number) <= (this._startIdx as number))
        ) {
          this.markAsScheduled();
          (this.getProperty() as Task).parents().forEach(
            (parent: PropertyTreeNode,) => {
              ((parent as Task).scenarioData(
                this.getScenarioIdx(),
              ) as TaskScenario).scheduleContainer();
            },
          );
          return false;
        }
        break;

      default:
        throw new Error(
          `Unknown task duration type ${this._durationType}`,
        );
    }

    return true;
  }

  /**
   * Book resources for current slot.
   */
  bookResources(): void {
    if (
      !this.project().anyResourceAvailable(this.currentSlotIdx() as number,) ||
      ((this.a("projectionmode",) as boolean) &&
        (this._nowIdx > (this.currentSlotIdx() as number)))
    ) {
      return;
    }

    if (!this.limitsOk(this.currentSlotIdx() as number,)) {
      return;
    }

    // Mandatory allocations check
    const takenMandatories: Resource[] = [];
    const mandatories = this._mandatories;
    for (const allocation of mandatories) {
      let found = false;
      const candidates = allocation.candidates;
      for (const candidate of candidates) {
        let allAvailable = true;
        for (const resource of candidate.allLeaves() as Resource[]) {
          if (
            !this.limitsOk(this.currentSlotIdx() as number, resource,) ||
            !(resource.scenarioData(this.getScenarioIdx(),) as ResourceScenario)
              .available(
                this.currentSlotIdx() as number,
              ) ||
            takenMandatories.includes(resource,)
          ) {
            allAvailable = false;
            break;
          } else {
            takenMandatories.push(resource,);
          }
        }
        if (allAvailable) {
          found = true;
          break;
        }
      }
      if (!found) {
        return;
      }
    }

    const allocate = this.a("allocate",) as Allocation[];
    for (const allocation of allocate) {
      const lockedCandidate = allocation.lockedResource;
      if (lockedCandidate) {
        if (this.bookResource(lockedCandidate,)) {
          allocation.lockedResource = lockedCandidate;
        }

        if (
          allocation.atomic &&
          (lockedCandidate.scenarioData(
            this.getScenarioIdx(),
          ) as ResourceScenario).bookedTask(
            this.currentSlotIdx() as number,
          )
        ) {
          this.rollbackBookings();
          return;
        }

        if (this.forward()) {
          const maxSlot = (lockedCandidate.scenarioData(
            this.getScenarioIdx(),
          ) as ResourceScenario).getMaxSlot();
          if (maxSlot === null || (this.currentSlotIdx() as number) < maxSlot) {
            // Continue
          } else {
            this.warning(
              "broken_persistence",
              `Persistence broken for Task ${
                (this.getProperty() as Task).fullId
              } - resource ${lockedCandidate.name} is gone`,
            );
            allocation.lockedResource = null;
          }
        } else {
          const minSlot = (lockedCandidate.scenarioData(
            this.getScenarioIdx(),
          ) as ResourceScenario).getMinSlot();
          if (minSlot === null || (this.currentSlotIdx() as number) > minSlot) {
            // Continue
          } else {
            this.warning(
              "broken_persistence",
              `Persistence broken for Task ${
                (this.getProperty() as Task).fullId
              } - resource ${lockedCandidate.name} is gone`,
            );
            allocation.lockedResource = null;
          }
        }
      }

      const candidates = allocation.candidates;
      for (const candidate of candidates) {
        if (this.bookResource(candidate,)) {
          if (allocation.persistent) {
            allocation.lockedResource = candidate;
          }
          break;
        }
      }
    }
  }

  /**
   * Book a specific resource. Returns true if the resource was booked.
   */
  bookResource(resource: PropertyTreeNode,): boolean {
    let booked = false;
    for (const r of resource.allLeaves() as Resource[]) {
      const rs = r.scenarioData(this.getScenarioIdx(),) as ResourceScenario;
      if (
        (this.a("effort",) as number) > 0 &&
          (rs.a("efficiency",) as number) >
            0.0 &&
          this._doneEffort >= (this.a("effort",) as number) ||
        !this.limitsOk(this.currentSlotIdx() as number, r,)
      ) {
        break;
      }

      if (
        rs.book(
          this.currentSlotIdx() as number,
          this.getProperty(),
        )
      ) {
        if (
          (this.a("effort",) as number) > 0 && this._doneEffort === 0
        ) {
          if (this.forward()) {
            this.propagateDate(
              this.project().idxToDate(this.currentSlotIdx() as number,),
              false,
              true,
            );
          } else {
            this.propagateDate(
              this.project().idxToDate((this.currentSlotIdx() as number) + 1,),
              true,
              true,
            );
          }
        }

        this._doneEffort += rs.a(
          "efficiency",
        ) as number;

        const assignedresources = this.a("assignedresources",) as unknown[];
        if (!assignedresources.includes(r,)) {
          assignedresources.push(r,);
        }
        booked = true;
      } else if (
        rs.bookedTask(
          this.currentSlotIdx() as number,
        )
      ) {
        const competitor = rs.bookedTask(
          this.currentSlotIdx() as number,
        ) as Task;
        if (!this._competitors.includes(competitor,)) {
          this._competitors.push(competitor,);
        }
        const contended = this._contendedResources.get(competitor,);
        if (contended) {
          contended.set(r, (contended.get(r,) || 0) + 1,);
        } else {
          this._contendedResources.set(
            competitor,
            new Map([[r, 1,],],),
          );
        }
      }
    }

    return booked;
  }

  /**
   * Rollback bookings for this task.
   */
  rollbackBookings(): void {
    const allocate = this.a("allocate",) as Allocation[];
    for (const allocation of allocate) {
      const candidates = allocation.candidates;
      for (const candidate of candidates) {
        for (const r of candidate.allLeaves() as Resource[]) {
          const rs = r.scenarioData(this.getScenarioIdx(),) as ResourceScenario;
          if (
            rs.bookedTask(this.currentSlotIdx() as number,) ===
              this.getProperty()
          ) {
            (rs.scoreboard as unknown as { set: (i: number, v: null,) => void })
              .set(
                this.currentSlotIdx() as number,
                null,
              );
          }
        }
      }
    }
  }

  /**
   * Schedule a container task based on its children's dates.
   */
  scheduleContainer(): void {
    if (
      this._scheduled || !(this.getProperty() as Task).container?.()
    ) {
      return;
    }

    let nStart: TjTime | null = null;
    let nEnd: TjTime | null = null;

    for (const child of (this.getProperty() as Task).children) {
      const childSc = child.scenarioData(
        this.getScenarioIdx(),
      ) as TaskScenario;
      if (
        !childSc.a("scheduled",) ||
        childSc.a("start",) === null ||
        childSc.a("end",) === null
      ) {
        return;
      }

      const childStart = childSc.a("start",) as TjTime;
      const childEnd = childSc.a("end",) as TjTime;

      if (nStart === null || childStart < nStart) {
        nStart = childStart;
      }
      if (nEnd === null || childEnd > nEnd) {
        nEnd = childEnd;
      }
    }

    if (nStart === null || nEnd === null) {
      return;
    }

    const task = this.getProperty() as Task;
    const taskSc = task.scenarioData(this.getScenarioIdx(),) as TaskScenario;
    let startSet = false;
    let endSet = false;

    if (
      taskSc.a("start",) === null || (taskSc.a("start",) as TjTime) > nStart
    ) {
      task.forceForScenario("start", nStart, this.getScenarioIdx(),);
      startSet = true;
    }
    if (taskSc.a("end",) === null || (taskSc.a("end",) as TjTime) < nEnd) {
      task.forceForScenario("end", nEnd, this.getScenarioIdx(),);
      endSet = true;
    }

    this.markAsScheduled();

    if (startSet) {
      this.propagateDate(nStart, false, true,);
    }
    if (endSet) {
      this.propagateDate(nEnd, true, true,);
    }
  }

  /**
   * Find the earliest possible start date for the task.
   */
  earliestStart(): TjTime | null {
    let startDate: TjTime | null = null;
    const depends = this.a("depends",) as TaskDependency[];

    for (const dependency of depends) {
      if (!dependency.task) {
        continue;
      }
      const potentialStartDate = dependency.task.scenarioData(
        this.getScenarioIdx(),
      ).a(
        dependency.onEnd ? "end" : "start",
      ) as TjTime;

      if (potentialStartDate === null) {
        return null;
      }

      // Determine the end date of a 'length' gap.
      let dateAfterLengthGap = potentialStartDate;
      let gapLength = dependency.gapLength || 0;
      const project = this.project();
      const endDate = project.get("end",) as TjTime;
      const granularity = project.get("scheduleGranularity",) as number;

      while (
        gapLength > 0 && dateAfterLengthGap.toSeconds() < endDate.toSeconds()
      ) {
        if (project.isWorkingTime(project.dateToIdx(dateAfterLengthGap,),)) {
          gapLength -= 1;
        }
        dateAfterLengthGap = TjTime.fromSeconds(
          dateAfterLengthGap.toSeconds() + granularity,
        );
      }

      // Determine the end date of a 'duration' gap.
      const gapDuration = dependency.gapDuration || 0;
      if (
        dateAfterLengthGap.toSeconds() >
          potentialStartDate.toSeconds() + gapDuration
      ) {
        // dateAfterLengthGap is later
      } else {
        dateAfterLengthGap = TjTime.fromSeconds(
          potentialStartDate.toSeconds() + gapDuration,
        );
      }

      if (
        startDate === null ||
        startDate.toSeconds() < dateAfterLengthGap.toSeconds()
      ) {
        startDate = dateAfterLengthGap;
      }
    }

    // If any of the parent tasks has an explicit start date, the task must
    // start at or after this date.
    let task: PropertyTreeNode | null = this.getProperty();
    while (task.parent) {
      task = task.parent;
      const parentSc = task.scenarioData(
        this.getScenarioIdx(),
      ) as TaskScenario;
      const parentStart = parentSc.a("start",) as TjTime;
      if (
        parentStart !== null &&
        (startDate === null || parentStart.toSeconds() > startDate.toSeconds())
      ) {
        startDate = parentStart;
        break;
      }
    }

    // When the computed start date is after the already determined end date
    // of the task, the start dependencies were too weak.
    const taskSc = (this.getProperty() as Task).scenarioData(
      this.getScenarioIdx(),
    ) as TaskScenario;
    const taskEnd = taskSc.a("end",) as TjTime;
    if (
      taskEnd !== null &&
      (startDate === null || startDate.toSeconds() > taskEnd.toSeconds())
    ) {
      this.error(
        "impossible_start_dep",
        `Task ${
          (this.getProperty() as Task).fullId
        } has start date dependencies that conflict with the end date.`,
      );
    }

    return startDate;
  }

  /**
   * Find the latest possible end date for the task.
   */
  latestEnd(): TjTime | null {
    let endDate: TjTime | null = null;
    const precedes = this.a("precedes",) as TaskDependency[];

    for (const dependency of precedes) {
      if (!dependency.task) {
        continue;
      }
      const potentialEndDate = dependency.task.scenarioData(
        this.getScenarioIdx(),
      ).a(
        dependency.onEnd ? "end" : "start",
      ) as TjTime;

      if (potentialEndDate === null) {
        return null;
      }

      // Determine the end date of a 'length' gap.
      let dateBeforeLengthGap = potentialEndDate;
      let gapLength = dependency.gapLength || 0;
      const project = this.project();
      const startDate = project.get("start",) as TjTime;
      const granularity = project.get("scheduleGranularity",) as number;

      while (
        gapLength > 0 && dateBeforeLengthGap.toSeconds() > startDate.toSeconds()
      ) {
        if (project.isWorkingTime(project.dateToIdx(dateBeforeLengthGap,),)) {
          gapLength -= 1;
        }
        dateBeforeLengthGap = TjTime.fromSeconds(
          dateBeforeLengthGap.toSeconds() - granularity,
        );
      }

      // Determine the end date of a 'duration' gap.
      const gapDuration = dependency.gapDuration || 0;
      if (
        dateBeforeLengthGap.toSeconds() <
          potentialEndDate.toSeconds() - gapDuration
      ) {
        // dateBeforeLengthGap is earlier
      } else {
        dateBeforeLengthGap = TjTime.fromSeconds(
          potentialEndDate.toSeconds() - gapDuration,
        );
      }

      if (
        endDate === null ||
        endDate.toSeconds() > dateBeforeLengthGap.toSeconds()
      ) {
        endDate = dateBeforeLengthGap;
      }
    }

    // If any of the parent tasks has an explicit end date, the task must
    // end at or before this date.
    let task: PropertyTreeNode | null = this.getProperty();
    while (task.parent) {
      task = task.parent;
      const parentSc = task.scenarioData(
        this.getScenarioIdx(),
      ) as TaskScenario;
      const parentEnd = parentSc.a("end",) as TjTime;
      if (
        parentEnd !== null &&
        (endDate === null || parentEnd.toSeconds() < endDate.toSeconds())
      ) {
        endDate = parentEnd;
        break;
      }
    }

    // When the computed end date is before the already determined start date
    // of the task, the end dependencies were too weak.
    const taskSc = (this.getProperty() as Task).scenarioData(
      this.getScenarioIdx(),
    ) as TaskScenario;
    const taskStart = taskSc.a("start",) as TjTime;
    if (
      taskStart !== null &&
      (endDate === null || endDate.toSeconds() < taskStart.toSeconds())
    ) {
      this.error(
        "impossible_end_dep",
        `Task ${
          (this.getProperty() as Task).fullId
        } has end date dependencies that conflict with the start date.`,
      );
    }

    return endDate;
  }

  /**
   * Finish scheduling: recursively descend into child tasks, compute
   * completion/status/gauge, propagate dates and merge this task's assigned
   * resources into every immediate parent (faithful to TaskScenario.rb).
   */
  finishScheduling(): void {
    const task = this.getProperty() as Task;
    const scIdx = this.getScenarioIdx();

    // Ruby TaskScenario.rb:410-430 — the finish pass descends into the children
    // first (bottom-up) and merges this task's `assignedresources` into every
    // immediate parent, with de-duplication. Idempotent through the `_finishDone`
    // flag (the recursion below runs only once per task).
    if (!this._finishDone) {
      // l.411-414: since the children finish first, the union already arrives
      // merged into this container and climbs one level per call up to the root.
      for (const child of task.kids()) {
        if (!(child instanceof Task)) continue;
        child.scenarioData(scIdx,).finishScheduling();
      }

      // l.416-423: merges this task's assigned resources into the
      // `assignedresources` list of every immediate parent (de-duplicated).
      // Since the children already finished, `this.a("assignedresources")`
      // already embeds the union of the descendants. Closes divergence 14C.12.4.
      // Note: the nullify of `@candidates/@mandatories/@allLimits` (Ruby
      // l.427-429) is only memory release / an accidental-use detector;
      // `limitsOk()` reads `allocation.candidates`, so we do not null them here
      // (no difference in the result).
      const assigned = (this.a("assignedresources",) as Resource[]) ?? [];
      if (assigned.length > 0) {
        for (const pTask of task.parents()) {
          // `getForScenario` returns `null` when the parent (container) has no
          // `assignedresources` stored yet — the list default is not
          // materialised. Collect, merge with de-duplication and **write back**
          // via `forceForScenario` (runtime write, a single scenario, without
          // the cross-scenario iteration of `setForScenario` in mode 0).
          const parentList = (pTask.getForScenario(
            "assignedresources",
            scIdx,
          ) as Resource[]) ?? [];
          let changed = false;
          for (const resource of assigned) {
            if (!parentList.includes(resource,)) {
              parentList.push(resource,);
              changed = true;
            }
          }
          if (changed) {
            pTask.forceForScenario("assignedresources", parentList, scIdx,);
          }
        }
      }
      this._finishDone = true;
    }

    // Completion housekeeping (pre-existing guard): keeps the original
    // semantics — runs only once and only for tasks not yet marked as scheduled
    // (containers never go through `markAsScheduled`).
    if (this._scheduled) return;
    this.calcCompletion();
    this.calcStatus();
    this.calcGauge();
    this.propagateDateToDep();

    this._scheduled = true;
  }

  /**
   * Check whether resource limits are ok for the current slot.
   */
  limitsOk(sbIdx: number, resource?: PropertyTreeNode,): boolean {
    const allocate = this.a("allocate",) as Allocation[];
    for (const allocation of allocate) {
      const candidates = allocation.candidates;
      for (const candidate of candidates) {
        for (const r of candidate.allLeaves() as Resource[]) {
          if (resource && r !== resource) {
            continue;
          }
          const rs = r.scenarioData(this.getScenarioIdx(),) as ResourceScenario;
          if (!rs.available(sbIdx,)) {
            return false;
          }
          if (allocation.mandatory && !rs.onShift(sbIdx,)) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * This function is not essential but does perform a large number of
   * consistency checks. It should be called after the scheduling run has been
   * finished.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:postScheduleCheck
   */
  postScheduleCheck(): boolean {
    this._errors = 0;
    const property = this.getProperty() as Task;
    for (const child of property.children) {
      const childScenarioData = child.scenarioData(
        this.getScenarioIdx(),
      ) as TaskScenario;
      this._errors += childScenarioData.postScheduleCheck() ? 0 : 1;
    }

    // There is no point to check the parent if the child(s) have errors.
    if (this._errors > 0) {
      return false;
    }

    // Same for runaway tasks. They have already been reported.
    if (this._isRunAway) {
      this.error(
        "sched_runaway",
        "Some tasks did not fit into the project time frame.",
      );
    }

    // Make sure the task is marked complete
    if (!this._scheduled) {
      this.error(
        "not_scheduled",
        `Task ${property.fullId} has not been marked as scheduled.`,
      );
    }

    // If the task has a follower or predecessor that is a runaway this task
    // is also incomplete.
    for (const [task, onEnd,] of this._startsuccs) {
      if (task && task.scenarioData(this.getScenarioIdx(),).isRunAway()) {
        return false;
      }
    }
    for (const [task, onEnd,] of this._endsuccs) {
      if (task && task.scenarioData(this.getScenarioIdx(),).isRunAway()) {
        return false;
      }
    }
    for (const [task, onEnd,] of this._startpreds) {
      if (task && task.scenarioData(this.getScenarioIdx(),).isRunAway()) {
        return false;
      }
    }
    for (const [task, onEnd,] of this._endpreds) {
      if (task && task.scenarioData(this.getScenarioIdx(),).isRunAway()) {
        return false;
      }
    }

    // Check if the start time is ok
    const start = this.a("start",) as TjTime | null;
    if (!start) {
      this.error(
        "task_start_undef",
        `Task ${property.fullId} has undefined start time`,
      );
    }
    const projectStart = this.project().get("start",) as TjTime | null;
    const projectEnd = this.project().get("end",) as TjTime | null;
    if (start && projectStart && projectEnd) {
      if (
        start.toSeconds() < projectStart.toSeconds() ||
        start.toSeconds() > projectEnd.toSeconds()
      ) {
        this.error(
          "task_start_range",
          `The start time (${start}) of task ${property.fullId} ` +
            `is outside the project interval (${projectStart} - ${projectEnd})`,
        );
      }
      const minstart = this.a("minstart",) as TjTime | null;
      if (minstart && start.toSeconds() < minstart.toSeconds()) {
        this.warning(
          "minstart",
          `The start time (${start}) of task ${property.fullId} ` +
            `is too early. Must be after ${minstart}.`,
        );
      }
      const maxstart = this.a("maxstart",) as TjTime | null;
      if (maxstart && start.toSeconds() > maxstart.toSeconds()) {
        this.warning(
          "maxstart",
          `The start time (${start}) of task ${property.fullId} ` +
            `is too late. Must be before ${maxstart}.`,
        );
      }
    }

    // Check if the end time is ok
    const end = this.a("end",) as TjTime | null;
    if (!end) {
      this.error(
        "task_end_undef",
        `Task ${property.fullId} has undefined end time`,
      );
    }
    if (end && projectStart && projectEnd) {
      if (
        end.toSeconds() < projectStart.toSeconds() ||
        end.toSeconds() > projectEnd.toSeconds()
      ) {
        this.error(
          "task_end_range",
          `The end time (${end}) of task ${property.fullId} ` +
            `is outside the project interval (${projectStart} - ${projectEnd})`,
        );
      }
      const minend = this.a("minend",) as TjTime | null;
      if (minend && end.toSeconds() < minend.toSeconds()) {
        this.warning(
          "minend",
          `The end time (${end}) of task ${property.fullId} ` +
            `is too early. Must be after ${minend}.`,
        );
      }
      const maxend = this.a("maxend",) as TjTime | null;
      if (maxend && end.toSeconds() > maxend.toSeconds()) {
        this.warning(
          "maxend",
          `The end time (${end}) of task ${property.fullId} ` +
            `is too late. Must be before ${maxend}.`,
        );
      }
    }

    // Make sure the start is before the end
    if (start && end && start.toSeconds() > end.toSeconds()) {
      this.error(
        "start_after_end",
        `The start time (${start}) of task ${property.fullId} ` +
          `is after the end time (${end}).`,
      );
    }

    // Check that tasks fits into parent task.
    const parent = property.parent as Task | null;
    if (parent) {
      const parentStart = parent.scenarioData(this.getScenarioIdx(),).a(
        "start",
      ) as TjTime | null;
      const parentEnd = parent.scenarioData(this.getScenarioIdx(),).a("end",) as
        | TjTime
        | null;
      if (parentStart && parentEnd) {
        if (start && start.toSeconds() < parentStart.toSeconds()) {
          this.error(
            "task_start_in_parent",
            `The start date (${start}) of task ${property.fullId} ` +
              `is before the start date (${parentStart}) ` +
              `of the enclosing task.`,
          );
        }
        if (end && end.toSeconds() > parentEnd.toSeconds()) {
          this.error(
            "task_end_in_parent",
            `The end date (${end}) of task ${property.fullId} ` +
              `is after the end date (${parentEnd}) ` +
              `of the enclosing task.`,
          );
        }
      }
    }

    // Check that all preceding tasks start/end before this task.
    const depends = this.a("depends",) as TaskDependency[];
    for (const dependency of depends) {
      const task = dependency.task;
      if (!task) continue;
      const limit = dependency.onEnd
        ? task.scenarioData(this.getScenarioIdx(),).a("end",) as TjTime | null
        : task.scenarioData(this.getScenarioIdx(),).a("start",) as
          | TjTime
          | null;
      if (!limit) continue;
      if (start && limit) {
        const limitSeconds = limit.toSeconds();
        const startSeconds = start.toSeconds();
        const gapDuration = dependency.gapDuration;
        const gapLength = dependency.gapLength;
        if (
          startSeconds < limitSeconds ||
          (gapDuration > 0 && limitSeconds + gapDuration > startSeconds) ||
          (gapLength > 0 &&
            this.project().slotsToDays(startSeconds - limitSeconds,) <
              gapLength)
        ) {
          this.error(
            "task_pred_before",
            `Task ${property.fullId} (${start}) must start ` +
              (gapDuration > 0
                ? `${gapDuration / (60 * 60 * 24)} days `
                : gapLength > 0
                ? `${this.project().slotsToDays(gapLength,)} working days `
                : "") +
              `after ${
                dependency.onEnd ? "end" : "start"
              } (${limit}) of task ` +
              `${task.fullId}. This condition could not be met.`,
          );
        }
      }
    }

    // Check that all following tasks end before this task
    const precedes = this.a("precedes",) as TaskDependency[];
    for (const dependency of precedes) {
      const task = dependency.task;
      if (!task) continue;
      const limit = dependency.onEnd
        ? task.scenarioData(this.getScenarioIdx(),).a("end",) as TjTime | null
        : task.scenarioData(this.getScenarioIdx(),).a("start",) as
          | TjTime
          | null;
      if (!limit) continue;
      if (end && limit) {
        const limitSeconds = limit.toSeconds();
        const endSeconds = end.toSeconds();
        const gapDuration = dependency.gapDuration;
        const gapLength = dependency.gapLength;
        if (
          limitSeconds < endSeconds ||
          (gapDuration > 0 && limitSeconds - gapDuration < endSeconds) ||
          (gapLength > 0 &&
            this.project().slotsToDays(limitSeconds - endSeconds,) < gapLength)
        ) {
          this.error(
            "task_succ_after",
            `Task ${property.fullId} (${end}) must end ` +
              (gapDuration > 0
                ? `${gapDuration / (60 * 60 * 24)} days `
                : gapLength > 0
                ? `${this.project().slotsToDays(gapLength,)} working days `
                : "") +
              `before ${
                dependency.onEnd ? "end" : "start"
              } (${limit}) of task ` +
              `${task.fullId}. This condition could not be met.`,
          );
        }
      }
    }

    if (this.a("milestone",)) {
      if (start && end && start.toSeconds() !== end.toSeconds()) {
        this.error(
          "milestone_times_equal",
          `Milestone ${property.fullId} must have identical start and end date.`,
        );
      }
    }

    if (
      property.leaf?.() && this.a("effort",) === 0 && !this.a("milestone",) &&
      (this.a("allocate",) as Allocation[]).length > 0 &&
      (this.a("assignedresources",) as Resource[]).length === 0
    ) {
      // The user used an 'allocate' for the task, but did not specify any
      // 'effort'. Actual allocations will only happen when resources are
      // available by chance. If there are no assigned resources, we generate
      // a warning as this is probably not what the user intended.
      this.warning(
        "allocate_no_assigned",
        `Task ${property.fullId} has resource allocation requested, but ` +
          `did not get any resources assigned. Either use 'effort' ` +
          `to ensure allocations or use a higher 'priority'.`,
      );
    }

    const competitors = this.a("competitors",) as Task[];
    const thieves: Task[] = [];
    for (const t of competitors) {
      if (
        (t.scenarioData(this.getScenarioIdx(),).a("priority",) as number) <
          (this.a("priority",) as number)
      ) {
        thieves.push(t,);
      }
    }
    if (!thieves.length) {
      this.warning(
        "priority_inversion",
        `Due to a mix of ALAP and ASAP scheduled tasks or a ` +
          `dependency on a lower priority tasks the following ` +
          `task${thieves.length > 1 ? "s" : ""} stole resources from ` +
          `${property.fullId} despite having a lower priority:`,
      );
      for (const t of thieves) {
        this.info(
          "priority_inversion_info",
          `Task ${t.fullId}`,
        );
      }
    }

    return this._errors === 0;
  }

  /**
   * Runs the user defined `fail`/`warn` checks of this task.
   *
   * The expression evaluation is provided by the query engine (Phase 11), so
   * only the presence of the attributes is verified for now.
   *
   * @see docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb:checkFailsAndWarnings
   */
  checkFailsAndWarnings(): void {
    const property = this.getProperty() as Task;
    for (const attrId of ["fail", "warn",]) {
      // fail/warn are non-scenario attributes (Project.rb:210/234:
      // isScenarioAttribute=false). Ruby's checkFailsAndWarnings reads
      // @attributes['fail'] directly, never the scenario attributes.
      const attr = property.getAttribute(attrId,);
      if (!attr) {
        continue;
      }
      this.warning(
        `${attrId}_check_unsupported`,
        `User defined ${attrId} check for task ${property.fullId} ` +
          `cannot be evaluated yet (requires the query engine).`,
      );
    }
  }

  /**
   * Compute completion percentage.
   *
   * Uses the user attribute `effortdone` (tracking cuts), NOT the scheduler's
   * internal `_doneEffort` counter. Ruby does the same in `calcTaskCompletion`
   * via `query_effortdone` / `@effortdone` (TaskScenario.rb:1347-1349,
   * 2425-2437). The port does not implement the scoreboard calculation
   * (`getEffectiveWork(startIdx, endIdx)`) yet, so it keeps the direct
   * approximation through the attribute.
   */
  calcCompletion(): void {
    const effort = this.a("effort",) as number;
    const effortDone = (this.a("effortdone",) as number) ?? 0;
    if (effort > 0) {
      this._complete = Math.round((effortDone / effort) * 100,);
    } else {
      this._complete = 0;
    }
  }

  /**
   * Compute status string.
   */
  calcStatus(): void {
    if (this._complete === null) {
      this.calcCompletion();
    }

    if (this._complete !== null) {
      const complete = this._complete;
      if (complete === 0.0) {
        this._status = this.a("milestone",) ? "not reached" : "not started";
      } else if (complete >= 100.0) {
        this._status = "done";
      } else {
        this._status = "in progress";
      }
    } else {
      this._status = "unknown";
    }
  }

  /**
   * Compute gauge string.
   */
  calcGauge(): void {
    this._gauge = (this._complete ?? 0).toString();
  }

  /**
   * Propagates a date to a dependent task (faithful two-argument version,
   * `TaskScenario.rb#propagateDateToDep`, 2373-2398). Called by the
   * `propagateDate` chain over the already resolved dependency lists.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:propagateDateToDep
   */
  propagateDateToDep(task: Task, atEnd: boolean,): void;
  /**
   * Argument-less variant that walks `depends` and restarts the scheduling of
   * already scheduled dependents (legacy internal use).
   *
   * 14C.12.3: in Ruby this path only runs with `@start`/`@end` already defined
   * (the argument-less variant does not exist in `TaskScenario.rb`); here the
   * own date may be undefined (task never scheduled), so the absence is treated
   * as "nothing to compare" instead of throwing `TypeError` in `toSeconds()` of
   * `null`.
   */
  propagateDateToDep(): void;
  propagateDateToDep(task?: Task, atEnd?: boolean,): void {
    if (task && atEnd !== undefined) {
      return this.propagateDateToDepInternal(task, atEnd,);
    }
    const depends = this.a("depends",) as TaskDependency[];
    for (const dependency of depends) {
      if (!dependency.task) {
        continue;
      }
      const dependent = dependency.task;
      const dependentScenarioData = dependent.scenarioData(
        this.getScenarioIdx(),
      ) as TaskScenario;
      if (!dependentScenarioData.a("scheduled",)) {
        continue;
      }

      const own = this.a(dependency.onEnd ? "end" : "start",) as
        | TjTime
        | null;
      if (own === null) continue;
      const other = dependentScenarioData.a(
        dependency.onEnd ? "start" : "end",
      ) as TjTime | null;
      if (other === null) continue;

      const changed = dependency.onEnd
        ? other.toSeconds() < own.toSeconds()
        : other.toSeconds() > own.toSeconds();

      if (changed) {
        dependent.scenarioData(this.getScenarioIdx(),).finishScheduling();
      }
    }
  }

  /**
   * Hands a decisive date to a dependent task.
   *
   * The dependent is skipped when it is already scheduled, is a container, or
   * already knows the date of that end; otherwise the date enters its
   * dependency set and may unlock it for scheduling.
   */
  private propagateDateToDepInternal(task: Task, atEnd: boolean,): void {
    const dep = task.scenarioData(this.getScenarioIdx(),) as TaskScenario;
    // Does not propagate when the task is already fully scheduled or is a
    // container.
    if (dep._scheduled || (task.container?.() ?? false)) return;

    // Does not propagate when the task already has a date for that end.
    if (dep.a(atEnd ? "end" : "start",) !== null) return;

    // Does not propagate when the task has a duration spec and the end to set
    // lies in the scheduling direction.
    if (dep.hasDurationSpec() && !(atEnd !== dep.forward())) return;

    // Uses the latest/earliest possible date only when every other dependency
    // of that end has already been determined.
    const nDate = atEnd ? dep.latestEnd() : dep.earliestStart();
    if (nDate === null) return;

    dep.propagateDate(nDate, atEnd, false,);
  }

  // ==================================================================
  // Wave B2 — portable query_* (TaskScenario.rb:1290-1557) + helpers.
  //
  // The base accessors already exist (turnover, getAllocatedTime,
  // complete/status/gauge, preds/succs, assignedResources per scenario) or are
  // ported below. The `Query.process` dispatch reaches these methods in
  // stage i (`data[scIdx].query_X`).
  // ==================================================================

  /**
   * Effective work per period (faithful port of `TaskScenario#getEffectiveWork
   * (startIdx, endIdx, resource)` — Ruby l.1592-1619). Differs from
   * `getAllocatedTime` by summing the *effective work* of the resources.
   */
  effWorkInPeriod(
    startIdx: number,
    endIdx: number,
    resource: Resource | null,
  ): number {
    const task = this.getProperty() as Task;
    const assigned = (this.a("assignedresources",) as Resource[]) ?? [];
    const res = (resource ? (resource.ptn?.() ?? resource) : null) as
      | Resource
      | null;
    if (
      this.milestone() || startIdx >= endIdx ||
      (res !== null && !assigned.some((r,) => (r.ptn?.() ?? r) === res))
    ) {
      return 0.0;
    }
    const scIdx = this.getScenarioIdx();
    let workLoad = 0.0;
    if (task.container()) {
      for (const child of task.kids()) {
        workLoad += (child as Task).scenarioData(scIdx,).effWorkInPeriod(
          startIdx,
          endIdx,
          res,
        );
      }
    } else if (res) {
      workLoad += (res.scenarioData(scIdx,) as ResourceScenario)
        .getEffectiveWork(
          startIdx,
          endIdx,
          task,
        );
    } else {
      for (const r of assigned) {
        workLoad += (r.scenarioData(scIdx,) as ResourceScenario)
          .getEffectiveWork(
            startIdx,
            endIdx,
            task,
          );
      }
    }
    return workLoad;
  }

  /**
   * Time-off intervals (off-duty/leave) shared by the task's resources.
   *
   * A leaf inherits the intervals of the assigned resources (intersection) or,
   * without resources, the project global leaves. A container intersects the
   * children intervals. The result always starts restricted to the
   * `[project['start'], project['end']]` interval.
   *
   * Port faithful to `TaskScenario.rb#collectTimeOffIntervals` (l.1623-1649);
   * omits the `@dCache` as in `getAllocatedTime`.
   */
  collectTimeOffIntervals(
    iv: TimeInterval,
    minDuration: number,
  ): IntervalList<TimeInterval> {
    const task = this.getProperty() as Task;
    const project = task.project;
    let il = new IntervalList<TimeInterval>();
    il.push(
      new TimeInterval(
        project.get("start",) as TjTime,
        project.get("end",) as TjTime,
      ),
    );

    const scIdx = this.getScenarioIdx();
    if (task.leaf()) {
      const resources = (this.a("assignedresources",) as Resource[]) ?? [];
      if (resources.length > 0) {
        // Task with resources: uses the intervals common to all of them.
        for (const resource of resources) {
          il = il.intersect(
            resource.scenarioData(scIdx,).collectTimeOffIntervals(
              iv,
              minDuration,
            ),
          );
        }
      } else {
        // No assigned resources: uses the global leaves.
        il = il.intersect(
          project.collectTimeOffIntervals?.(iv, minDuration,) ??
            new IntervalList<TimeInterval>(),
        );
      }
    } else {
      for (const kid of task.kids()) {
        il = il.intersect(
          (kid as Task).scenarioData(scIdx,).collectTimeOffIntervals(
            iv,
            minDuration,
          ),
        );
      }
    }
    return il;
  }

  /**
   * Resources allocated in the interval (port faithful to `assignedResources`,
   * Ruby l.1731-1749), filtered by `Resource#allocated?`.
   */
  private taskAssignedResources(interval: TimeInterval | null,): Resource[] {
    const scIdx = this.getScenarioIdx();
    const iv = interval ??
      new TimeInterval(
        this.a("start",) as TjTime,
        this.a("end",) as TjTime,
      );
    const task = this.getProperty() as Task;
    const list: Resource[] = [];
    if (task.container()) {
      for (const child of task.kids()) {
        for (
          const r of (child as Task).scenarioData(scIdx,).taskAssignedResources(
            iv,
          )
        ) {
          if (!list.includes(r,)) list.push(r,);
        }
      }
    } else {
      const assigned = (this.a("assignedresources",) as Resource[]) ?? [];
      for (const resource of assigned) {
        if (resource.allocated(scIdx, iv, task,)) list.push(resource,);
      }
    }
    return list;
  }

  /** Project with the helpers beyond `ProjectLike` (dateToIdx force, load). */
  private projExt(): {
    dateToIdx(date: TjTime, forceIntoProject?: boolean,): number;
    convertToDailyLoad(seconds: number,): number;
    get(name: string,): unknown;
    accounts: { get(id: string,): unknown };
  } {
    return this.project() as unknown as {
      dateToIdx(date: TjTime, forceIntoProject?: boolean,): number;
      convertToDailyLoad(seconds: number,): number;
      get(name: string,): unknown;
      accounts: { get(id: string,): unknown };
    };
  }

  /** RTF handlers for the `listItem` branch of the query lists. */
  private rtfHandlers(): ReturnType<typeof RTFHandlers.create> {
    return RTFHandlers.create(
      this.project() as unknown as Parameters<typeof RTFHandlers.create>[0],
    );
  }

  /** Renders a RichText list item (the `query.listItem` branch). */
  private renderListItem(
    query: TaskScenarioQuery,
    property: PropertyTreeNode,
    extra: (q: TaskScenarioQuery,) => void,
  ): string | null {
    if (!query.listItem) return null;
    const rti = new RichText(query.listItem, this.rtfHandlers(),)
      .generateIntermediateFormat();
    if (!rti) return null;
    const q = query.dup();
    q.property = property;
    extra(q,);
    (rti as unknown as { setQuery(q: unknown,): void }).setQuery(q,);
    return `<nowiki>${(rti as unknown as { to_s(): string }).to_s()}</nowiki>`;
  }

  /** Pre/successor with a date (port `generateDepencyListItem`, Ruby l.2712). */
  private generateDepencyListItem(
    query: TaskScenarioQuery,
    task: Task,
    dep: string,
    date: string,
  ): string {
    const rendered = this.renderListItem(query, task, (q,) => {
      q.setCustomData("dependency", { string: dep, },);
      q.setCustomData("date", { string: date, },);
    },);
    return rendered ??
      `<nowiki>${task.name} (${task.fullId}) ${dep} ${date}</nowiki>`;
  }

  /** List of tasks that have a start (port `generateTaskList`, Ruby l.2727). */
  private generateTaskList(
    taskList: Task[],
    query: TaskScenarioQuery,
  ): string[] {
    const list: string[] = [];
    const scIdx = this.getScenarioIdx();
    const tf = (this.project().get("timeFormat",) as string | null) ??
      query.timeFormat ?? undefined;
    for (const task of taskList) {
      const start = task.scenarioData(scIdx,).a("start",) as TjTime | null;
      const date = start ? start.to_s(tf,) : "";
      const rendered = this.renderListItem(query, task, (q,) => {
        q.setCustomData("date", { string: date, },);
      },);
      list.push(
        rendered ?? `<nowiki>${task.name} (${task.fullId}) ${date}</nowiki>`,
      );
    }
    return list;
  }

  /** Limite de data ou sentinela -1 (port `queryDateLimit`, Ruby l.2762). */
  private queryDateLimit(query: TaskScenarioQuery, date: TjTime | null,): void {
    if (date) {
      query.sortable = query.numerical = date;
      query.string = date.to_s(query.timeFormat ?? undefined,);
    } else {
      query.sortable = query.numerical = -1;
      query.string = "";
    }
  }

  /** Overlaps the query window? (common prefix of active/closed/open). */
  private overlapsQuery(query: TaskScenarioQuery,): boolean {
    const start = this.a("start",) as TjTime | null;
    const end = this.a("end",) as TjTime | null;
    if (!start || !end || !query.start || !query.end) return false;
    return new TimeInterval(start, end,).overlaps(
      new TimeInterval(query.start, query.end,),
    );
  }

  /** Active tasks in the period (port `activeTasks`, Ruby l.2534). */
  private activeTasks(query: TaskScenarioQuery,): number {
    if (!this.overlapsQuery(query,)) return 0;
    const task = this.getProperty() as Task;
    if (task.leaf()) {
      const now = this.project().get("now",) as TjTime;
      const start = this.a("start",) as TjTime;
      const end = this.a("end",) as TjTime;
      return start.toSeconds() <= now.toSeconds() &&
          now.toSeconds() < end.toSeconds()
        ? 1
        : 0;
    }
    let cnt = 0;
    for (const kid of task.kids()) {
      cnt += (kid as Task).scenarioData(this.getScenarioIdx(),).closedTasks(
        query,
      );
    }
    return cnt;
  }

  /** Closed tasks in the period (port `closedTasks`, Ruby l.2550). */
  private closedTasks(query: TaskScenarioQuery,): number {
    if (!this.overlapsQuery(query,)) return 0;
    const task = this.getProperty() as Task;
    if (task.leaf()) {
      const now = this.project().get("now",) as TjTime;
      const end = this.a("end",) as TjTime;
      return end.toSeconds() <= now.toSeconds() ? 1 : 0;
    }
    let cnt = 0;
    for (const kid of task.kids()) {
      cnt += (kid as Task).scenarioData(this.getScenarioIdx(),).closedTasks(
        query,
      );
    }
    return cnt;
  }

  /** Open tasks in the period (port `openTasks`, Ruby l.2565). */
  private openTasks(query: TaskScenarioQuery,): number {
    if (!this.overlapsQuery(query,)) return 0;
    const task = this.getProperty() as Task;
    if (task.leaf()) {
      const now = this.project().get("now",) as TjTime;
      const end = this.a("end",) as TjTime;
      return end.toSeconds() > now.toSeconds() ? 1 : 0;
    }
    let cnt = 0;
    for (const kid of task.kids()) {
      cnt += (kid as Task).scenarioData(this.getScenarioIdx(),).openTasks(
        query,
      );
    }
    return cnt;
  }

  /** Any predecessor on the task itself or on its ancestors (Ruby l.2216). */
  private hasPredecessors(): boolean {
    let t = this.getProperty() as Task | null;
    const scIdx = this.getScenarioIdx();
    while (t) {
      if (t.scenarioData(scIdx,).startpreds().length > 0) return true;
      t = t.parent as Task | null;
    }
    return false;
  }

  /** Any successor on the task itself or on its ancestors (Ruby l.2228). */
  private hasSuccessors(): boolean {
    let t = this.getProperty() as Task | null;
    const scIdx = this.getScenarioIdx();
    while (t) {
      if (t.scenarioData(scIdx,).endsuccs().length > 0) return true;
      t = t.parent as Task | null;
    }
    return false;
  }

  /** Input (milestone without pred), recursive (Ruby l.2582). */
  private collectInputs(
    foundInputs: Task[],
    includeChildren: boolean,
    checked: Set<string>,
  ): void {
    const task = this.getProperty() as Task;
    const sig = `${task.fullId}|${includeChildren}`;
    if (checked.has(sig,)) return;
    checked.add(sig,);
    if (task.leaf() && !this.hasPredecessors() && this.milestone()) {
      foundInputs.push(task,);
      return;
    }
    const scIdx = this.getScenarioIdx();
    if (includeChildren) {
      for (const child of task.kids()) {
        (child as Task).scenarioData(scIdx,).collectInputs(
          foundInputs,
          true,
          checked,
        );
      }
    }
    for (const [t,] of this.startpreds()) {
      if (t) t.scenarioData(scIdx,).collectInputs(foundInputs, false, checked,);
    }
    if (task.parent) {
      (task.parent as Task).scenarioData(scIdx,).collectInputs(
        foundInputs,
        false,
        checked,
      );
    }
  }

  /** Output (milestone without succ), recursive (Ruby l.2617). */
  private collectTargets(
    foundTargets: Task[],
    includeChildren: boolean,
    checked: Set<string>,
  ): void {
    const task = this.getProperty() as Task;
    const sig = `${task.fullId}|${includeChildren}`;
    if (checked.has(sig,)) return;
    checked.add(sig,);
    if (task.leaf() && !this.hasSuccessors() && this.milestone()) {
      foundTargets.push(task,);
      return;
    }
    const scIdx = this.getScenarioIdx();
    for (const [t,] of this.endsuccs()) {
      if (t) {
        t.scenarioData(scIdx,).collectTargets(foundTargets, false, checked,);
      }
    }
    if (task.parent) {
      (task.parent as Task).scenarioData(scIdx,).collectTargets(
        foundTargets,
        false,
        checked,
      );
    }
    if (includeChildren) {
      for (const child of task.kids()) {
        (child as Task).scenarioData(scIdx,).collectTargets(
          foundTargets,
          true,
          checked,
        );
      }
    }
  }

  /** Sorts by start asc, tie-broken by seqno desc (Ruby setSorting). */
  private sortTaskList(list: Task[],): void {
    const scIdx = this.getScenarioIdx();
    list.sort((a, b,) => {
      const sa = a.scenarioData(scIdx,).a("start",) as TjTime | null;
      const sb = b.scenarioData(scIdx,).a("start",) as TjTime | null;
      const c = (sa ? sa.toSeconds() : 0) - (sb ? sb.toSeconds() : 0);
      if (c !== 0) return c;
      return b.sequenceNo - a.sequenceNo;
    },);
  }

  // ---- os 24 query_* ----

  /** `activetasks` column: number of active tasks under this one. */
  query_activetasks(query: TaskScenarioQuery,): void {
    const count = this.activeTasks(query,);
    query.sortable = query.numerical = count;
    query.string = `${Math.trunc(count,)}`;
  }

  /** `closedtasks` column: number of closed tasks under this one. */
  query_closedtasks(query: TaskScenarioQuery,): void {
    const count = this.closedTasks(query,);
    query.sortable = query.numerical = count;
    query.string = `${Math.trunc(count,)}`;
  }

  /** `competitors` column: number of tasks competing for the allocations. */
  query_competitorcount(query: TaskScenarioQuery,): void {
    const n = this._competitors.length;
    query.sortable = query.numerical = n;
    query.string = `${n}`;
  }

  /**
   * `complete` column: completion percentage.
   *
   * A value written by the tracking scenario wins; otherwise the ratio is
   * recalculated on demand.
   */
  query_complete(query: TaskScenarioQuery,): void {
    // Ruby unifies the scenario attribute `complete` with `@complete`: a value
    // stored by `setForScenario` (e.g. a tracking trail) is what the query
    // returns; only when there is no declared value does it recalculate via
    // `calcCompletion`. Without this, reports that write `complete` directly
    // (iCal PERCENT-COMPLETE) would stop reflecting the stored source.
    const declared = this.a("complete",) as number | null;
    let val = typeof declared === "number" ? declared : null;
    if (val === null) {
      let c = this.complete();
      if (c === null || c === undefined) {
        this.calcCompletion();
        c = this.complete();
      }
      val = c ?? 0;
    }
    query.sortable = query.numerical = val;
    query.string = `${Math.trunc(val,)}%`;
  }

  /** `cost` column: turnover billed to `query.costAccount` in the interval. */
  query_cost(query: TaskScenarioQuery,): void {
    const account = query.costAccount
      ? (this.projExt().accounts.get(query.costAccount,) as Account | null)
      : null;
    if (account) {
      const cost = this.turnover(
        query.startIdx ?? 0,
        query.endIdx ?? 0,
        account,
        query.scopeProperty as Resource | null,
      );
      query.sortable = query.numerical = cost;
      query.string = query.currencyFormat
        ? query.currencyFormat.format(cost,)
        : String(cost,);
    } else {
      query.string = "No 'balance' defined!";
    }
  }

  /** `duration` column: `end - start` in days, scaled for display. */
  query_duration(query: TaskScenarioQuery,): void {
    const start = this.a("start",) as TjTime | null;
    const end = this.a("end",) as TjTime | null;
    const duration = start && end
      ? (end.toSeconds() - start.toSeconds()) / (60 * 60 * 24)
      : 0;
    query.sortable = query.numerical = duration;
    query.string = query.scaleDuration(duration,);
  }

  /**
   * `effortdone` column: effort consumed so far.
   *
   * Uses the declared `effortdone` attribute when present, otherwise the work
   * reported between project start and `now`.
   */
  query_effortdone(query: TaskScenarioQuery,): void {
    const effortdone = this.a("effortdone",) as number | null;
    let effort: number;
    if (effortdone) {
      effort = this.projExt().convertToDailyLoad(
        effortdone * (this.project().get("scheduleGranularity",) as number),
      );
    } else {
      const p = this.projExt();
      effort = this.effWorkInPeriod(
        p.dateToIdx(this.project().get("start",) as TjTime, false,),
        p.dateToIdx(this.project().get("now",) as TjTime,),
        query.scopeProperty as Resource | null,
      );
    }
    query.sortable = query.numerical = effort;
    query.string = query.scaleLoad(effort,);
  }

  /** `effortleft` column: work reported between `now` and project end. */
  query_effortleft(query: TaskScenarioQuery,): void {
    const p = this.projExt();
    const effort = this.effWorkInPeriod(
      p.dateToIdx(this.project().get("now",) as TjTime,),
      p.dateToIdx(this.project().get("end",) as TjTime, false,),
      query.scopeProperty as Resource | null,
    );
    query.sortable = query.numerical = effort;
    query.string = query.scaleLoad(effort,);
  }

  /** `effort` column: effective work in the query interval. */
  query_effort(query: TaskScenarioQuery,): void {
    const work = this.effWorkInPeriod(
      query.startIdx ?? 0,
      query.endIdx ?? 0,
      query.scopeProperty as Resource | null,
    );
    query.sortable = query.numerical = work;
    query.string = query.scaleLoad(work,);
  }

  /** `followers` column: successor tasks with their dependency glyphs. */
  query_followers(query: TaskScenarioQuery,): void {
    const scIdx = this.getScenarioIdx();
    const tf = query.timeFormat ?? undefined;
    const list: string[] = [];
    for (const [task, onEnd,] of this.startsuccs()) {
      if (!task) continue;
      const d = task.getForScenario(onEnd ? "end" : "start", scIdx,) as
        | TjTime
        | null;
      const dep = onEnd ? "[->]" : "[->[";
      list.push(
        this.generateDepencyListItem(query, task, dep, d ? d.to_s(tf,) : "",),
      );
    }
    for (const [task, onEnd,] of this.endsuccs()) {
      if (!task) continue;
      const d = task.getForScenario(onEnd ? "end" : "start", scIdx,) as
        | TjTime
        | null;
      const dep = onEnd ? "]->]" : "]->[";
      list.push(
        this.generateDepencyListItem(query, task, dep, d ? d.to_s(tf,) : "",),
      );
    }
    query.assignList(list,);
  }

  /** `gauge` column: traffic-light symbol, calculated on demand. */
  query_gauge(query: TaskScenarioQuery,): void {
    if (this.gauge() === null || this.gauge() === undefined) this.calcGauge();
    query.string = this.gauge() ?? "";
  }

  /** `headcount` column: summed efficiency of the assigned resources. */
  query_headcount(query: TaskScenarioQuery,): void {
    let headcount = 0;
    const scIdx = this.getScenarioIdx();
    const iv = query.start && query.end
      ? new TimeInterval(query.start, query.end,)
      : null;
    for (const res of this.taskAssignedResources(iv,)) {
      const eff = (res.getForScenario("efficiency", scIdx,) as number | null) ??
        100;
      headcount += Math.round(eff,);
    }
    query.sortable = query.numerical = headcount;
    query.string = query.numberFormat
      ? query.numberFormat.format(headcount,)
      : String(headcount,);
  }

  /** `inputs` column: task list of everything this task depends on. */
  query_inputs(query: TaskScenarioQuery,): void {
    const found: Task[] = [];
    this.collectInputs(found, true, new Set(),);
    const task = this.getProperty() as Task;
    const list = found.filter((t,) => t !== task);
    this.sortTaskList(list,);
    query.assignList(this.generateTaskList(list, query,),);
  }

  /** `maxend` column: latest allowed end, or the empty marker. */
  query_maxend(query: TaskScenarioQuery,): void {
    this.queryDateLimit(query, this.a("maxend",) as TjTime | null,);
  }

  /** `maxstart` column: latest allowed start, or the empty marker. */
  query_maxstart(query: TaskScenarioQuery,): void {
    this.queryDateLimit(query, this.a("maxstart",) as TjTime | null,);
  }

  /** `minend` column: earliest allowed end, or the empty marker. */
  query_minend(query: TaskScenarioQuery,): void {
    this.queryDateLimit(query, this.a("minend",) as TjTime | null,);
  }

  /** `minstart` column: earliest allowed start, or the empty marker. */
  query_minstart(query: TaskScenarioQuery,): void {
    this.queryDateLimit(query, this.a("minstart",) as TjTime | null,);
  }

  /** `opentasks` column: number of open tasks under this one. */
  query_opentasks(query: TaskScenarioQuery,): void {
    const count = this.openTasks(query,);
    query.sortable = query.numerical = count;
    query.string = `${Math.trunc(count,)}`;
  }

  /** `precursors` column: predecessor tasks with their dependency glyphs. */
  query_precursors(query: TaskScenarioQuery,): void {
    const scIdx = this.getScenarioIdx();
    const tf = query.timeFormat ?? undefined;
    const list: string[] = [];
    for (const [task, onEnd,] of this.startpreds()) {
      if (!task) continue;
      const d = task.getForScenario(onEnd ? "end" : "start", scIdx,) as
        | TjTime
        | null;
      const dep = onEnd ? "]->[" : "[->[";
      list.push(
        this.generateDepencyListItem(query, task, dep, d ? d.to_s(tf,) : "",),
      );
    }
    for (const [task, onEnd,] of this.endpreds()) {
      if (!task) continue;
      const d = task.getForScenario(onEnd ? "end" : "start", scIdx,) as
        | TjTime
        | null;
      const dep = onEnd ? "]->]" : "[->]";
      list.push(
        this.generateDepencyListItem(query, task, dep, d ? d.to_s(tf,) : "",),
      );
    }
    query.assignList(list,);
  }

  /** `resources` column: assigned resources actually allocated in the interval. */
  query_resources(query: TaskScenarioQuery,): void {
    const scIdx = this.getScenarioIdx();
    const task = this.getProperty() as Task;
    const iv = query.start && query.end
      ? new TimeInterval(query.start, query.end,)
      : null;
    const list: string[] = [];
    for (const resource of this.taskAssignedResources(iv,)) {
      if (!resource.allocated(scIdx, iv as TimeInterval, task,)) continue;
      const rendered = this.renderListItem(query, resource, (q,) => {
        q.scopeProperty = task;
      },);
      list.push(
        rendered ??
          `<nowiki>${resource.name} (${resource.fullId})</nowiki>`,
      );
    }
    query.assignList(list,);
  }

  /** `revenue` column: turnover credited to `query.revenueAccount`. */
  query_revenue(query: TaskScenarioQuery,): void {
    const account = query.revenueAccount
      ? (this.projExt().accounts.get(query.revenueAccount,) as Account | null)
      : null;
    if (account) {
      const revenue = this.turnover(
        query.startIdx ?? 0,
        query.endIdx ?? 0,
        account,
        query.scopeProperty as Resource | null,
      );
      query.sortable = query.numerical = revenue;
      query.string = query.currencyFormat
        ? query.currencyFormat.format(revenue,)
        : String(revenue,);
    } else {
      query.string = "No 'balance' defined!";
    }
  }

  /** `scheduling` column: `ASAP` for leaf tasks, empty for containers. */
  query_scheduling(query: TaskScenarioQuery,): void {
    // Ruby: `query.string = 'ASAP' if @property.leaf?` (containers stay
    // without a string). Kept faithful.
    if ((this.getProperty() as Task).leaf()) query.string = "ASAP";
  }

  /** `status` column: status symbol, calculated on demand. */
  query_status(query: TaskScenarioQuery,): void {
    if (this.status() === "") this.calcStatus();
    query.string = this.status();
  }

  /** `targets` column: task list of the milestones this task feeds. */
  query_targets(query: TaskScenarioQuery,): void {
    const found: Task[] = [];
    this.collectTargets(found, true, new Set(),);
    const task = this.getProperty() as Task;
    const list = found.filter((t,) => t !== task);
    this.sortTaskList(list,);
    query.assignList(this.generateTaskList(list, query,),);
  }
}
