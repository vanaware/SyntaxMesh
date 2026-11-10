import { PropertySet, } from "./property-set.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { PropertyLike, } from "./property-like.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type CostEvent, } from "./cost-event.ts";
import { SourceFileInfo, } from "../source-file-info.ts";
import { TjArgumentError, } from "../attributes/errors.ts";
import { NotYetImplementedError, TjError, TjInternalError, } from "./errors.ts";
import { AttributeBase, } from "../attributes/attribute-base.ts";
import { AttributeDefinition, } from "../attributes/attribute-definition.ts";
import { AttributeType, } from "../attributes/attribute-type.ts";
import { TjTime, } from "../time/tj-time.ts";
import { RealFormat, } from "../format/real-format.ts";
import { getOffsetSeconds, } from "../time/timezone.ts";
import { Scoreboard, } from "../time/scoreboard.ts";
import { IntervalList, } from "../time/interval-list.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { WorkingHours, } from "../calendar/working-hours.ts";
import { Limits, } from "../scheduling/limits.ts";
import { ShiftAssignments, } from "../scheduling/shift-assignments.ts";
import { TimeSheets, } from "../timesheet/time-sheets.ts";
import { DataCache, } from "../scheduling/data-cache.ts";
import { Journal, } from "./journal.ts";
import { defaultAlertLevels, } from "./alert-levels.ts";
import { ReportContext, } from "../reports/report-context.ts";
import { Report, } from "./report.ts";
import { ReportType, } from "./report-type.ts";
// Deliberate (Ruby `Project#generateReport` creates the parser): the cycle
// model → parser only resolves at runtime, since the reference is used inside
// the method, never during module evaluation.
import { ProjectFileParser, } from "../parser/project-file-parser.ts";
import { Task, } from "./task.ts";
import { Resource, } from "./resource.ts";
import { TaskScenario, } from "./task-scenario.ts";
import { ResourceScenario, } from "./resource-scenario.ts";
import { Account, type CostType, } from "./account.ts";
import { Shift, } from "./shift.ts";
import { Scenario, } from "./scenario.ts";
import { PropertyList, } from "./property-list.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { Log, } from "../log.ts";
import { AppConfig, } from "../app-config.ts";
import { initTj3Config, } from "../tj3-config.ts";

// Import attribute registration functions statically (synchronous)
import { registerScenarioAttributes, } from "../model/attributes/scenario-attributes.ts";
import { registerShiftAttributes, } from "../model/attributes/shift-attributes.ts";
import { registerAccountAttributes, } from "../model/attributes/account-attributes.ts";
import { registerResourceAttributes, } from "../model/attributes/resource-attributes.ts";
import { registerTaskAttributes, } from "../model/attributes/task-attributes.ts";
import { registerReportAttributes, } from "../model/attributes/report-attributes.ts";
import { registerMaterialAttributes, } from "../model/attributes/material-attributes.ts";
import type { MaterialBooking, } from "./material-booking.ts";
import type { ChargeBooking, } from "./charge-booking.ts";

/**
 * Booking awaiting the declaration of its owning task. A `booking` declared in
 * the material or resource body may precede the `task` it references; we also
 * keep the scenario it appeared in (14C.11.5) and the task attribute it must
 * land in — `materialbookings` or `chargebookings` (14C.15.7).
 */
export interface PendingMaterialBooking {
  /** Material or charge booking still waiting for its owning task. */
  booking: MaterialBooking | ChargeBooking;
  /** Scenario the booking was declared in. */
  scenarioIdx: number;
  /** Scenario attribute of the task that receives the resolved booking. */
  attrId?: string;
}

/**
 * Root of the model: the parsed project and every collection inside it.
 *
 * A project owns the property sets (tasks, resources, accounts, …), the
 * scenario list, the working-hour calendar, the scoreboards used while
 * scheduling and the diagnostics produced by the last run. It is the object the
 * parser builds, the scheduler walks and the reports query.
 */
export class Project implements ProjectLike {
  /** Project id (`project <id> "name" …`). */
  readonly id: string;
  /** Human-readable project name. */
  readonly name: string;
  /** Version string reported in headers and generated documents. */
  readonly version: string;
  private attributes: Map<string, unknown>;
  /** Declared scenarios (at least one: the plain project). */
  readonly scenarios: PropertySet;
  /** Shift definitions usable by resources and tasks. */
  readonly shifts: PropertySet;
  /** Chart of accounts. */
  readonly accounts: PropertySet;
  /** Resource hierarchy (groups and leaves). */
  readonly resources: PropertySet;
  /** Task hierarchy (containers and leaves). */
  readonly tasks: PropertySet;
  /** Report definitions. */
  readonly reports: PropertySet;
  /** Material catalog. */
  readonly materials: PropertySet;
  /**
   * Navigators defined through the `navigator "id"` directive (Ruby:
   * `@project['navigators']`). Copied by the parser during the parse; the
   * `RTFNavigator` reads this map to render the bar.
   */
  readonly navigators: Map<string, unknown>;
  /** Files the project was parsed from, in the order they were opened. */
  readonly inputFiles: string[];
  /** Time sheets declared in the project or injected by the sheets apps. */
  readonly timeSheets: TimeSheets;
  /** Report contexts, one per report being generated concurrently. */
  readonly reportContexts: ReportContext[];
  /** Directory report files are written to; empty for in-memory use. */
  outputDir: string;
  /** When `true`, scheduling warns about deviations in time-sheet bookings. */
  warnTsDeltas: boolean;
  /** Availability/limit scoreboard of the running scheduling pass. */
  scoreboard: Scoreboard<number | null> | null;
  /** Scoreboard variant that ignores container tasks. */
  scoreboardNoLeaves: Scoreboard<number | null> | null;
  /** Per-slot availability of every resource, built before scheduling. */
  resourceAvailability: Scoreboard<boolean> | null;
  /** Auditable cost events accumulated by the financial layer. */
  readonly costEvents: CostEvent[];
  /** Scenario used to record actuals, or `null` when the project has none. */
  readonly trackingScenario: string | null;
  /**
   * ID of the universal default account (`defaultaccount <id>`, appendix §10
   * / 14C.9). It is rule 4 of `resolveAccount` when there is no explicit
   * account, no source chargeset and no task chargeset. Stored as an **ID**
   * because the `project` block comes before the `account` declarations
   * (forward reference).
   */
  defaultAccountId: string | null;
  /**
   * IDs of the per-type default accounts (`defaultaccount material|resource|
   * charge <id>`). A present variant **precedes** the universal one for its
   * type. The `charge` type maps to the `CostType` `task`.
   */
  readonly defaultAccountIds: Map<CostType, string>;
  /**
   * Material (or charge) bookings read before the declaration of the owning
   * task (forward reference). Emptied by `flushPendingBookings()` at the end of
   * the parse.
   */
  readonly pendingBookings: PendingMaterialBooking[] = [];

  /**
   * Binds the pending bookings to their tasks and appends each one to the
   * task's scenario attribute (`materialbookings` or `chargebookings`,
   * 14C.15.7). Idempotent: whatever is still without a task stays in the queue
   * for a future call. Returns how many were resolved in this pass.
   */
  flushPendingBookings(): number {
    if (this.pendingBookings.length === 0) return 0;
    const pending = this.pendingBookings.splice(
      0,
      this.pendingBookings.length,
    );
    let resolved = 0;
    for (const entry of pending) {
      if (!entry.booking.resolveTask(this,)) {
        this.pendingBookings.push(entry,);
        continue;
      }
      const task = entry.booking.task!;
      const attrId = entry.attrId ?? "materialbookings";
      const current = (task.getForScenario(
        attrId,
        entry.scenarioIdx,
      ) ?? []) as unknown[];
      if (current.includes(entry.booking,)) {
        resolved++;
        continue;
      }
      task.setForScenario(
        attrId,
        current.concat([entry.booking,],),
        entry.scenarioIdx,
      );
      resolved++;
    }
    return resolved;
  }

  /**
   * Default account for a cost type: type variant → universal → `null`.
   * Resolves the ID in the accounts PropertySet on every call (the parser
   * accepts forward references). A `null` `type` resolves the universal one
   * only.
   */
  defaultAccountFor(type: CostType | null,): Account | null {
    const id = (type ? this.defaultAccountIds.get(type,) : undefined) ??
      this.defaultAccountId;
    return id === null || id === undefined ? null : this.account(id,);
  }

  /** `true` when any task in the project declares a booking. */
  hasBookings(_scIdx: number,): boolean {
    return false;
  }
  /** `true` when the project is scheduled in projection mode. */
  isProjectionMode(_scIdx: number,): boolean {
    return false;
  }

  /**
   * Attribute object of the project, resolved per scenario.
   *
   * Scenario-specific attributes win; attributes that only exist at project
   * level (`name`, `id`, `seqno`, …) come from the `plan` scenario.
   *
   * @param scIdx Scenario whose value is wanted.
   * @param id Attribute name.
   */
  getScenarioAttribute(
    scIdx: number,
    id: string,
  ): AttributeBase<unknown> {
    const scenario = this.scenarios.get("plan",);
    if (scenario) {
      // Try to get scenario-specific attribute first
      try {
        return scenario.getScenarioAttribute(scIdx, id,);
      } catch (e) {
        // If attribute is not scenario-specific (e.g., name, id, seqno),
        // fall back to the base attribute
        if (
          e instanceof TjArgumentError &&
          e.message.includes("não é específico de cenário",)
        ) {
          return scenario.getAttribute(id,);
        }
        // If attribute is unknown (e.g., task attribute like "effort"),
        // search all PropertySets for the definition and create the scenario attribute
        if (
          e instanceof TjArgumentError &&
          e.message.includes("Unknown attribute '",)
        ) {
          // Search all PropertySets for the attribute definition
          const propertySets = [
            this.scenarios,
            this.shifts,
            this.accounts,
            this.resources,
            this.tasks,
            this.reports,
            this.materials,
          ];
          for (const ps of propertySets) {
            const attrDef = ps.attributeDefinition(id,);
            if (attrDef && attrDef.isScenarioAttribute) {
              // Create the scenario attribute on the plan scenario using the found definition
              // We need to bypass the scenario's attributeDefinition lookup
              // by directly creating the attribute using the found attrDef
              if (!scenario.data[scIdx]) {
                throw new TjInternalError(
                  "ScenarioData must be initialized before scenario-specific attributes",
                );
              }
              const attr = new attrDef.objClass(
                scenario,
                attrDef,
                scenario.data[scIdx],
              );
              if (!scenario.scenarioAttributes[scIdx]) {
                scenario.scenarioAttributes[scIdx] = new Map();
              }
              scenario.scenarioAttributes[scIdx].set(id, attr,);
              return attr;
            }
          }
        }
        throw e;
      }
    }
    return null as unknown as AttributeBase<unknown>;
  }

  /**
   * Looks up the definition of the attribute `id` in this project.
   *
   * @param id Attribute name as written in the project file.
   * @returns The definition, or `undefined` when the attribute is unknown.
   */
  attributeDefinition(id: string,): AttributeDefinition<unknown> | undefined {
    return this.scenarios.attributeDefinition(id,);
  }

  /**
   * Creates a project and registers the attribute dictionary of every type.
   *
   * @param id Project id.
   * @param name Human-readable name.
   * @param version Version string reported in headers.
   * @param _flatNamespace Accepted for API parity; unused.
   */
  constructor(
    id: string,
    name: string,
    version: string,
    _flatNamespace?: boolean,
  ) {
    this.id = id;
    this.name = name;
    this.version = version;
    this.attributes = new Map();
    this.inputFiles = [];
    this.timeSheets = new TimeSheets();
    this.reportContexts = [];
    this.outputDir = "";
    this.warnTsDeltas = false;
    this.scoreboard = null;
    this.scoreboardNoLeaves = null;
    this.resourceAvailability = null;
    this.costEvents = [];
    this.trackingScenario = null;
    this.defaultAccountId = null;
    this.defaultAccountIds = new Map();

    // Initialize AppConfig
    initTj3Config();

    // Default project attributes (Ruby defaults from Project.rb)
    this.attributes.set("dailyworkinghours", 8.0,);
    this.attributes.set("yearlyworkingdays", 260.714,);
    // Identity in the attribute map: Ruby's `@data` carries `'name'`,
    // `'projectid'` and `'version'` from the constructor (Project.rb l.88-118)
    // and several places in the port read `project.get('name')` — the HTML
    // `<title>` (Report.rb `generateHTML`), the `Project: …` header of
    // niku/mspxml.
    this.attributes.set("name", name,);
    this.attributes.set("projectid", id,);
    this.attributes.set("version", version,);
    this.attributes.set("projectids", [id,],);

    // Ruby default formats (Project.rb l.89-92): without them the numeric
    // cells fall back to the 2-decimal `Query#scaleValue` and the CSV prints
    // `4.33`/`5` where `tj3` writes `4.3`/`5.0` (CLI golden, 24.7.6).
    this.attributes.set(
      "numberFormat",
      new RealFormat(["-", "", "", ".", 1,],),
    );
    this.attributes.set(
      "currencyFormat",
      new RealFormat(["-", "", "", ",", 2,],),
    );
    this.attributes.set("timeFormat", "%Y-%m-%d",);
    this.attributes.set("shortTimeFormat", "%H:%M",);

    // PropertySets: Ruby Project.rb fixes the namespace per collection —
    // scenarios/shifts/accounts/resources are flat (short global IDs);
    // tasks/reports are hierarchical (dotted fullId). The constructor
    // parameter has no counterpart in the original TJ.
    this.scenarios = new PropertySet(this, true,);
    this.shifts = new PropertySet(this, true,);
    this.accounts = new PropertySet(this, true,);
    this.resources = new PropertySet(this, true,);
    this.tasks = new PropertySet(this, false,);
    this.reports = new PropertySet(this, false,);
    // Materials: hierarchical IDs like tasks (allocation rollup, C1).
    this.materials = new PropertySet(this, false,);
    this.navigators = new Map();
    this.attributes.set("scheduleGranularity", 3600,);
    this.attributes.set("timezone", TjTime.getTimeZone(),);
    this.attributes.set("weekStartsMonday", true,);
    this.attributes.set("loadUnit", "days",);
    this.attributes.set("currency", "EUR",);
    this.attributes.set("priority", 500,);
    this.attributes.set("rate", 0.0,);
    // Global default timebasis (phase 10 complement C2.2, #6): `duration`
    // preserves the TJ semantics of calendar days for cost distribution.
    this.attributes.set("timebasis", "duration",);
    this.attributes.set("now", TjTime.now().align(3600,),);

    // Default alert levels (Ruby AlertLevelDefinitions#initialize; module
    // brought forward in 14C.0.7). Objects {id, name, color}; they can be
    // replaced by the `alertlevels` directive in the project block.
    this.attributes.set("alertLevels", defaultAlertLevels(),);

    // Register attributes synchronously
    registerScenarioAttributes(this.scenarios,);
    registerShiftAttributes(this.shifts,);
    registerAccountAttributes(this.accounts,);
    registerResourceAttributes(this.resources,);
    registerTaskAttributes(this.tasks,);
    registerReportAttributes(this.reports,);
    registerMaterialAttributes(this.materials,);

    // Create initial plan scenario
    const planScenario = new Scenario(this, "plan", "Plan", null,);
    // The scenario attributes are already registered via registerScenarioAttributes on the PropertySet
    // and the Scenario constructor initializes scenarioAttributes via PropertyTreeNode
    // So no additional action needed here
  }

  /** Number of declared scenarios. */
  get scenarioCount(): number {
    return this.scenarios.items;
  }

  /**
   * Overrides `deepClone` so that references to the project do not drag a deep
   * copy of the whole project along (Ruby: `Project#deep_clone`).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Project.rb#deep_clone
   */
  deepClone(): this {
    return this;
  }

  /**
   * Resolves a scenario by index or id.
   *
   * @param arg Position (`0`-based) or scenario id.
   * @returns The scenario, or `null` when neither matches.
   */
  scenario(arg: number | string,): Scenario | null {
    if (typeof arg === "number") {
      let seqNo = 1;
      for (const sc of this.scenarios.toArray()) {
        if (sc.sequenceNo - 1 === arg) {
          return sc as Scenario;
        }
        seqNo++;
      }
      return null;
    } else {
      const scenario = this.scenarios.get(arg,);
      return scenario ? (scenario as Scenario) : null;
    }
  }

  /**
   * Position of a scenario in the project.
   *
   * @param sc Scenario object or id.
   * @returns `0`-based index, or `undefined` when the id is unknown.
   */
  scenarioIdx(sc: Scenario | string,): number | undefined {
    if (typeof sc === "string") {
      const scenario = this.scenarios.get(sc,);
      return scenario ? scenario.sequenceNo - 1 : undefined;
    }
    return sc.sequenceNo - 1;
  }

  /** Shift with the given id, or `null` when undeclared. */
  shift(id: string,): Shift | null {
    const prop = this.shifts.get(id,);
    return prop ? (prop as Shift) : null;
  }

  /** Account with the given id, or `null` when undeclared. */
  account(id: string,): Account | null {
    const prop = this.accounts.get(id,);
    return prop ? (prop as Account) : null;
  }

  /** Task with the given id, or `null` when undeclared. */
  task(id: string,): Task | null {
    const prop = this.tasks.get(id,);
    return prop ? (prop as Task) : null;
  }

  /** Project journal (Ruby Project.rb `self['journal']`). */
  readonly journal: Journal = new Journal();

  /** Resource with the given id, or `null` when undeclared. */
  resource(id: string,): Resource | null {
    const prop = this.resources.get(id,);
    return prop ? (prop as Resource) : null;
  }

  /** Material with the given id, or `null` when undeclared. */
  material(id: string,): import("./material.ts").Material | null {
    const prop = this.materials.get(id,);
    return prop ? (prop as import("./material.ts").Material) : null;
  }

  /** Report with the given id, or `null` when undeclared. */
  report(id: string,): Report | null {
    const prop = this.reports.get(id,);
    return prop ? (prop as Report) : null;
  }

  /** Report with the given name, or `null` when undeclared. */
  reportByName(name: string,): Report | null {
    for (const prop of this.reports.toArray()) {
      if (prop.name === name) {
        return prop as Report;
      }
    }
    return null;
  }

  /** Reads a project attribute (`project` block or defaults). */
  get(name: string,): unknown {
    return this.attributes.get(name,);
  }

  /**
   * Writes a project attribute and re-derives the calendar when needed.
   *
   * Changing `start`, `end`, `scheduleGranularity` or `timezone` invalidates
   * the working hours, so {@link reinitializeWorkingHours} runs afterwards.
   */
  set(name: string, value: unknown,): void {
    this.attributes.set(name, value,);

    if (
      name === "start" || name === "end" || name === "scheduleGranularity" ||
      name === "timezone"
    ) {
      this.reinitializeWorkingHours();
    }
  }

  /**
   * Rebuilds the `WorkingHours` calendar from `start`, `end` and `timezone`.
   *
   * Bails out while either end is not a real {@link TjTime}: like the Ruby
   * original, raw strings stored in the attribute map are ignored.
   */
  private reinitializeWorkingHours(): void {
    // Reinitialize working hours based on new start/end/timezone
    // This matches Ruby Project.rb:522-525 — only create WorkingHours
    // if both start and end are already set (Ruby guards this).
    // The values must be TjTime instances (Ruby stores Date objects here);
    // raw strings are stored verbatim and skipped, matching the Ruby
    // behavior where WorkingHours.new would only be called with real
    // Date values from the attribute system.
    const start = this.get("start",);
    const end = this.get("end",);
    if (!(start instanceof TjTime) || !(end instanceof TjTime)) {
      return;
    }
    const granularity = this.get("scheduleGranularity",) as number;
    const timezone = this.get("timezone",) as string;

    // Create WorkingHours instance
    const workinghours = new WorkingHours(
      granularity,
      start.toDate(),
      end.toDate(),
      timezone,
    );
    this.attributes.set("workinghours", workinghours,);
  }

  /**
   * Reports an error through the process-wide handler.
   *
   * @param id Stable message id.
   * @param text Human-readable description.
   * @param sfi Source location, when known.
   * @param property Property the message belongs to; accepted for API parity.
   */
  error(
    id: string,
    text: string,
    sfi?: SourceFileInfo | null,
    property?: PropertyLike,
  ): void {
    MessageHandlerInstance.instance.error(id, text, sfi, null, null, null,);
  }

  /**
   * Reports a warning through the process-wide handler.
   *
   * @param id Stable message id.
   * @param text Human-readable description.
   * @param sfi Source location, when known.
   * @param property Property the message belongs to; accepted for API parity.
   */
  warning(
    id: string,
    text: string,
    sfi?: SourceFileInfo | null,
    property?: PropertyLike,
  ): void {
    MessageHandlerInstance.instance.warning(id, text, sfi, null, null, null,);
  }

  /** Working hours of one day (`dailyworkinghours`, default 8). */
  dailyWorkingHours(): number {
    return Number(this.get("dailyworkinghours",) ?? 8.0,);
  }

  /** Working days of a week, derived from the weekly working hours. */
  weeklyWorkingDays(): number {
    const workingHours = this.get("workinghours",) as unknown;
    const daily = this.dailyWorkingHours();
    if (workingHours === null || workingHours === undefined) {
      return daily > 0 ? 40 / daily : 5;
    }
    return (workingHours as { weeklyWorkingHours(): number })
      .weeklyWorkingHours() / daily;
  }

  /** Working days of a month (`yearlyworkingdays / 12`). */
  monthlyWorkingDays(): number {
    return Number(this.get("yearlyworkingdays",) ?? 260.714,) / 12.0;
  }

  /** Working days of a year (`yearlyworkingdays`, default 260.714). */
  yearlyWorkingDays(): number {
    return Number(this.get("yearlyworkingdays",) ?? 260.714,);
  }

  slotsToDays(slots: number,): number {
    const granularity = Number(this.get("scheduleGranularity",) ?? 3600,);
    const daily = this.dailyWorkingHours();
    return slots * granularity / (3600 * daily);
  }

  /** Converts a duration in seconds into daily load units. */
  convertToDailyLoad(seconds: number,): number {
    const daily = this.dailyWorkingHours();
    return seconds / (daily * 3600);
  }

  /** Number of slots in the current scoreboard, or `0` before one exists. */
  scoreboardSize(): number {
    return this.scoreboard?.size || 0;
  }

  idxToDate(idx: number,): TjTime {
    if (this.scoreboard) {
      return TjTime.fromDate(this.scoreboard.idxToDate(idx,),);
    }
    const start = this.get("start",) as TjTime | undefined;
    if (!start) {
      return TjTime.fromString("2026-01-01",);
    }
    const granularity = (this.get("scheduleGranularity",) as number) ?? 3600;
    return TjTime.fromSeconds(start.toSeconds() + idx * granularity,);
  }

  /**
   * Ruby Project.rb:961 — `forceIntoProject` clamps to the plan limits (before
   * → 0, after → last slot); without the clamp, a date outside the range is an
   * error. The port ignored the parameter (negative/overflowing indices leaked
   * into the calls); fixed in the 2nd wave of Complement 11.
   */
  dateToIdx(date: TjTime, forceIntoProject: boolean = true,): number {
    const start = this.get("start",) as TjTime | undefined;
    if (!start) {
      return 0;
    }
    const end = this.get("end",) as TjTime | undefined;
    const granularity = (this.get("scheduleGranularity",) as number) ?? 3600;
    if (end && date.toSeconds() > end.toSeconds()) {
      if (!forceIntoProject) {
        throw new TjError(
          `Date ${date} is out of project time range ` +
            `(${start} - ${end})`,
        );
      }
      const size = this.scoreboard?.size ??
        Math.ceil((end.toSeconds() - start.toSeconds()) / granularity,) + 1;
      return size - 1;
    }
    if (date.toSeconds() < start.toSeconds()) {
      if (!forceIntoProject) {
        throw new TjError(
          `Date ${date} is out of project time range ` +
            `(${start} - ${end})`,
        );
      }
      return 0;
    }
    const diff = date.toSeconds() - start.toSeconds();
    return Math.floor(diff / granularity,);
  }

  isWorkingTime(sbIdx: number,): boolean {
    if (!this.scoreboard) {
      return true;
    }
    return this.scoreboard.get(sbIdx,) === null;
  }

  /** `true` when the scoreboard marks slot `sbIdx` as working time. */
  hasWorkingTime(sbIdx: number,): boolean {
    return this.isWorkingTime(sbIdx,);
  }

  /** Number of working days inside the interval (slot indices, inclusive). */
  workingDays(interval: { start: number; end: number },): number {
    let workingDays = 0;
    for (let idx = interval.start; idx <= interval.end; idx++) {
      if (this.isWorkingTime(idx,)) {
        workingDays++;
      }
    }
    return workingDays;
  }

  /** Number of working slots between `startIdx` and `endIdx`. */
  getWorkSlots(startIdx: number, endIdx: number,): number {
    let workSlots = 0;
    for (let idx = startIdx; idx <= endIdx; idx++) {
      if (this.isWorkingTime(idx,)) {
        workSlots++;
      }
    }
    return workSlots;
  }

  anyResourceAvailable(sbIdx: number,): boolean {
    return this.resourceAvailability?.get(sbIdx,) || false;
  }

  /**
   * Global project time-off (off-duty/leave) intervals.
   *
   * Faithful port of `Project.rb#collectTimeOffIntervals` (l.976-981): filters
   * the project scoreboard by the slots whose off-duty/leave bit (mask `0x3E`)
   * is set. Without a scoreboard (project not yet scheduled) the leaves cannot
   * be known → empty list.
   */
  collectTimeOffIntervals(
    iv: TimeInterval,
    minDuration: number,
  ): IntervalList<TimeInterval> {
    if (this.scoreboard === null) return new IntervalList<TimeInterval>();
    return this.scoreboard.collectIntervals(
      iv,
      minDuration,
      (v,) => typeof v === "number" && (v & 0x3E) !== 0,
    );
  }

  /**
   * Display name of a task or resource attribute.
   *
   * Port of `Project#attributeName` (Ruby l.1038): Ruby looks the id up in the
   * task dictionary and, failing that, in the resource dictionary — never in the
   * project's own dictionary. The previous version looked at `scenarios`, which
   * only knows project attributes, which is why column headers such as `start`,
   * `end` and `effort` came out empty in reports.
   *
   * @param id Attribute id to translate.
   * @returns The display name, or `undefined` when the attribute is unknown.
   */
  attributeName(id: string,): string | undefined {
    return this.tasks.attributeName(id,) ?? this.resources.attributeName(id,);
  }

  /**
   * Short single-line description of the project.
   *
   * @returns `Project(id=…, name=…, version=…)`.
   */
  to_s(): string {
    return `Project(id=${this.id}, name=${this.name}, version=${this.version})`;
  }

  /** Adds a scenario (parity hook; the constructor registers itself). */
  addScenario(_s: Scenario,): void {
    // Scenario is already registered via PropertyTreeNode constructor
    // This matches the pattern of addTask/addResource/addAccount/addShift/addReport
    // which are all no-ops since their constructors auto-register
  }

  /** Adds a shift (parity hook; the parser fills the set). */
  addShift(_s: unknown,): void {}

  /** Adds an account (parity hook; the parser fills the set). */
  addAccount(_a: unknown,): void {}

  /** Adds a task (parity hook; the parser fills the set). */
  addTask(_t: unknown,): void {}

  /** Adds a resource (parity hook; the parser fills the set). */
  addResource(_r: unknown,): void {}

  /** Adds a report (parity hook; the parser fills the set). */
  addReport(_r: unknown,): void {}

  /** Adds a material (parity hook; the parser fills the set). */
  addMaterial(_m: unknown,): void {}

  /**
   * Detaches an account from the project.
   *
   * @param account Node to remove; non-node values are ignored.
   */
  removeAccount(account: unknown,): void {
    if (account instanceof PropertyTreeNode) {
      this.accounts.removeProperty(account,);
    }
  }

  // 9.8 — Project.generateReports + generateReport + listReports
  /**
   * Generates every report that declares at least one `formats` entry.
   *
   * Runs one {@link ReportContext} per report on the main thread (`maxCpuCores`
   * is accepted for API parity but unused in the browser) and flushes the data
   * cache afterwards, as the Ruby original does.
   *
   * @param maxCpuCores Worker budget; ignored by this port.
   */
  generateReports(maxCpuCores: number,): void {
    // Ignorar maxCpuCores (browser)
    this.reports.index();
    for (const report of this.reports.toArray()) {
      const formats = report.get("formats",) as unknown[] | undefined;
      if (!formats || formats.length === 0) {
        continue;
      }
      Log.startProgressMeter(`Report ${report.name}`,);
      this.reportContexts.push(new ReportContext(this, report as Report,),);
      (report as Report).generate();
      this.reportContexts.pop();
      Log.stopProgressMeter();
    }
    // Ruby `Project#generateReports` flushes the data cache at the end.
    // (`data-cache.ts` already implements `flush()` — the old `// stub` was a
    // leftover. xray §5.4, fixed 2026-11-03.)
    DataCache.instance.flush();
  }

  /**
   * Generates one report, or every report matching a pattern.
   *
   * `dynamicAttributes` injects extra attribute definitions for this run only;
   * each generated report still runs inside its own {@link ReportContext}.
   *
   * @param reportId Report id, or a regular expression when `regExpMode` is set.
   * @param regExpMode Treat `reportId` as a pattern.
   * @param formats Output formats to force, or `null`/`undefined` for the
   *   report's own `formats` attribute.
   * @param dynamicAttributes Snippet with attribute definitions to inject.
   */
  generateReport(
    reportId: string,
    regExpMode: boolean,
    formats?: string[] | null,
    dynamicAttributes?: string | null,
  ): void {
    let reportList: string[];
    if (regExpMode) {
      reportList = this.matchingReports(reportId,);
    } else {
      reportList = this.reports.get(reportId,) ? [reportId,] : [];
    }
    for (const id of reportList) {
      const report = this.reports.get(id,);
      if (!report) {
        this.error(
          "unknown_report_id",
          "Request to generate unknown report " + id,
        );
        continue;
      }
      if (formats === null || formats === undefined) {
        const reportFormats = report.get("formats",) as unknown[] | undefined;
        if (!reportFormats || reportFormats.length === 0) {
          this.error("formats_empty", "Formats empty for report " + id,);
          continue;
        }
      }
      this.reportContexts.push(new ReportContext(this, report as Report,),);
      // Ruby l.795-811: with `dynamicAttributes` the report has its attributes
      // saved, the columns injected and then restored — `interactive` marks the
      // generation as "came from the editor" (changes the file name). The
      // backup/restore only happens with a **non-empty** snippet: with `""`
      // Ruby only sets `interactive` and the attribute remains after
      // generation.
      const attributes = dynamicAttributes ?? null;
      const backup = attributes !== null && attributes !== ""
        ? report.backupAttributes()
        : null;
      if (attributes !== null) {
        if (attributes !== "") {
          const parser = new ProjectFileParser();
          parser.project = this;
          parser.parseReportAttributes(report as Report, attributes,);
        }
        report.set("interactive", true,);
      }
      (report as Report).generate(formats as string[] | undefined,);
      if (backup !== null) report.restoreAttributes(backup,);
      this.reportContexts.pop();
    }
  }

  /** Logs the id, formats and name of every matching report. */
  listReports(reportId: string, regExpMode: boolean,): void {
    let reportList: string[];
    if (regExpMode) {
      reportList = this.matchingReports(reportId,);
    } else {
      reportList = this.reports.get(reportId,) ? [reportId,] : [];
    }
    if (reportList.length === 0) {
      console.log(`No match for ${reportId}`,);
    }
    for (const id of reportList) {
      const report = this.reports.get(id,);
      if (!report) continue;
      const formats = report.get("formats",) as unknown[] | undefined;
      if (!formats || formats.length === 0) continue;
      console.log(`${id}\t${formats.join(", ",)}\t${report.name}`,);
    }
  }

  /** Warns about the project-level conditions that would silence output. */
  checkReports(): void {
    if (this.reports.items === 0) {
      this.warning(
        "no_report_defined",
        "This project has no reports defined. No output data will be generated.",
      );
    }
    if (!this.accounts.empty()) {
      for (const report of this.reports.toArray()) {
        if ((report as Report).typeSpec === ReportType.AccountReport) continue;
        const costAccount = report.get("costaccount",);
        const revenueAccount = report.get("revenueaccount",);
        if (!costAccount || !revenueAccount) {
          this.warning(
            "report_without_balance",
            "The report " + report.fullId +
              " has no 'balance' defined. No cost or revenue computation will be possible.",
            report.sourceFileInfo as unknown as SourceFileInfo | null,
          );
        }
      }
    }
    for (const report of this.reports.toArray()) {
      const formats = report.get("formats",) as unknown[] | undefined;
      if (!formats || formats.length === 0) {
        this.warning(
          "all_formats_empty",
          "None of the reports has a 'formats' attribute. No output data will be generated.",
          report.sourceFileInfo as unknown as SourceFileInfo | null,
        );
        return;
      }
    }
  }

  /**
   * Adds or removes the `csv` format on every trace report.
   *
   * @param enable `true` to append `csv`, `false` to drop it.
   */
  enableTraceReports(enable: boolean,): void {
    for (const report of this.reports.toArray()) {
      if ((report as Report).typeSpec !== ReportType.TraceReport) continue;
      let formats = report.get("formats",) as unknown[] | undefined;
      if (!formats) {
        formats = [];
      }
      if (enable) {
        if (!formats.includes("csv",)) {
          formats.push("csv",);
        }
      } else {
        const idx = formats.indexOf("csv",);
        if (idx !== -1) {
          formats.splice(idx, 1,);
        }
      }
      report.set("formats", formats,);
    }
  }

  /**
   * Ids of the reports whose full id matches `reportId` as a regular
   * expression.
   *
   * Used by the `report` directive, which accepts a regex instead of a single
   * literal id. An invalid pattern matches nothing.
   *
   * @param reportId Regular expression to test against every report full id.
   * @returns Full ids of the matching reports, in registration order.
   */
  matchingReports(reportId: string,): string[] {
    const list: string[] = [];
    let regex: RegExp;
    try {
      regex = new RegExp(reportId,);
    } catch {
      // Not a valid regex: fall back to exact match
      return list;
    }
    for (const report of this.reports.toArray()) {
      const id = report.fullId;
      if (regex.test(id,)) {
        list.push(id,);
      }
    }
    return list;
  }

  /** Biggest scheduling granularity the local time zone allows, in seconds. */
  static maxScheduleGranularity(): number {
    // Ruby: Time.gm(2000, 1, 1).getlocal.min — the minutes of the local clock in
    // the active time zone (TjTime.setTimeZone updates the global zone).
    const offsetSec = getOffsetSeconds(
      Date.UTC(2000, 0, 1,) / 1000,
      TjTime.getTimeZone(),
    );
    const min = ((Math.round(offsetSec / 60,) % 60) + 60) % 60;
    if (min === 0) return 3600;
    if (min === 30) return 1800;
    if (min === 15 || min === 45) return 900;
    throw new TjInternalError(`Unknown Time zone alignment ${min}`,);
  }

  /**
   * Schedules every active scenario, then runs the post-schedule checks.
   *
   * The pass is: index the property sets, propagate inherited attributes in
   * mode 1 (`prepareScenario`), schedule in mode 2 so computed values are marked
   * as such (`scheduleScenario`), and finally complete the data sets and check
   * the result (`finishScenario`). Failed/warning tasks and resources are
   * collected once the last scenario is done.
   *
   * @returns `true` when the schedule completed; failed tasks are reported
   *   through the message handler rather than by a `false` return.
   */
  schedule(): boolean {
    this.initScoreboards();

    // Set all index counters to their proper values
    this.shifts.index();
    this.accounts.index();
    this.resources.index();
    this.tasks.index();

    if (this.tasks.items === 0) {
      this.error("no_tasks", "No tasks defined",);
    }

    for (const sc of this.scenarios.toArray()) {
      // Skip disabled scenarios
      if (!sc.get("active",)) continue;

      const scIdx = this.scenarioIdx(sc,)!;

      // All user provided values are set now. The next step is to
      // propagate inherited values. These values must be marked as
      // inherited by setting the mode to 1. As we always call
      // PropertyTreeNode#inherit this is just a safeguard.
      AttributeBase.setMode(1,);
      this.prepareScenario(scIdx,);

      // Now change to mode 2 so all values that are modified are marked
      // as computed.
      AttributeBase.setMode(2,);
      // Schedule the scenario.
      this.scheduleScenario(scIdx,);

      // Complete the data sets, and check the result.
      this.finishScenario(scIdx,);
    }

    // Check for failed tasks and resources after all scenarios are scheduled
    // Check for failed tasks and resources after all scenarios are scheduled
    // Ruby: resources.each { resource.checkFailsAndWarnings } (once per resource)
    //      tasks.each { task.checkFailsAndWarnings } (once per task)
    for (const resource of this.resources.toArray()) {
      // Resource has scenarioData for each scenario, but checkFailsAndWarnings
      // checks global (non-scenario) attributes 'fail'/'warn' (isScenarioAttribute=false)
      // So call it once per resource (not per scenario)
      (resource.scenarioData(0,) as ResourceScenario).checkFailsAndWarnings();
    }

    for (const task of this.tasks.toArray()) {
      (task.scenarioData(0,) as TaskScenario).checkFailsAndWarnings();
    }

    if (this.warnTsDeltas) {
      this.timeSheets.warnOnDelta();
    }
    return true;
  }

  // 9.8.3.2 — checkTimeSheets
  /** Runs the checks of every declared time sheet. */
  checkTimeSheets(): void {
    this.timeSheets.check();
  }

  /** Allocates both scoreboards, one slot per granularity step. */
  private initScoreboards(): void {
    // Create scoreboard and mark all slots as unavailable
    const start = this.get("start",) as TjTime;
    const end = this.get("end",) as TjTime;
    const granularity = this.get("scheduleGranularity",) as number;
    this.scoreboard = new Scoreboard(
      start.toDate(),
      end.toDate(),
      granularity,
      2,
    );
    // And the same for another scoreboard.
    this.scoreboardNoLeaves = new Scoreboard(
      start.toDate(),
      end.toDate(),
      granularity,
      2,
    );

    const workinghours = this.get("workinghours",) as unknown;

    // Change all work time slots to nil (available) again.
    let date = this.scoreboard.idxToDate(0,);
    const delta = this.get("scheduleGranularity",) as number;
    const scoreboardSize = this.scoreboardSize();
    for (let i = 0; i < scoreboardSize; i++) {
      if (
        workinghours &&
        (workinghours as { onShift?: (arg: TjTime | number,) => boolean })
          .onShift?.(
            TjTime.fromDate(date,),
          )
      ) {
        this.scoreboard.set(i, null,);
        this.scoreboardNoLeaves.set(i, null,);
      }
      date = new Date(date.getTime() + delta * 1000,);
    }

    // Mark all global leave slots as such
    const leaves = this.get("leaves",) as unknown;
    if (leaves) {
      for (
        const leave of leaves as { interval: { start: TjTime; end: TjTime } }[]
      ) {
        const startIdx = this.scoreboard.dateToIdx(
          leave.interval.start.toDate(),
        );
        const endIdx = this.scoreboard.dateToIdx(leave.interval.end.toDate(),);
        for (let i = startIdx; i < endIdx; i++) {
          // If the slot is nil or set to 4 then don't set the time-off bit.
          const sb = this.scoreboard.get(i,);
          this.scoreboard.set(
            i,
            ((sb === null || sb === 4) ? 0 : 2) | (1 << 2),
          );
        }
      }
    }
  }

  /**
   * Marks the slots where each resource used in the scenario is available.
   *
   * @param scIdx Scenario being prepared.
   * @param usedResources Resources that appear in at least one allocation.
   */
  private computeResourceAvailabilities(
    scIdx: number,
    usedResources: Resource[],
  ): void {
    const start = this.get("start",) as TjTime;
    const end = this.get("end",) as TjTime;
    const granularity = this.get("scheduleGranularity",) as number;
    this.resourceAvailability = new Scoreboard(
      start.toDate(),
      end.toDate(),
      granularity,
    );

    const scoreboardSize = this.scoreboardSize();
    for (let idx = 0; idx < scoreboardSize; idx++) {
      for (const resource of usedResources) {
        if (resource.scenarioData(scIdx,).available(idx,)) {
          this.resourceAvailability.set(idx, true,);
          break;
        }
      }
    }
  }

  /**
   * Resets the scenario state before scheduling: dependencies, tracking
   * values, limits and the working-time scoreboard.
   *
   * @param scIdx Scenario to prepare.
   */
  private prepareScenario(scIdx: number,): void {
    const resources = new PropertyList(this.resources,);
    const tasks = new PropertyList(this.tasks,);

    // Compile a list of leaf resources that are actually used in this
    // project.
    const usedResources: Resource[] = [];
    for (const task of tasks.toArray()) {
      for (
        const resource of (task.scenarioData(scIdx,) as TaskScenario)
          .candidates()
      ) {
        if (!usedResources.includes(resource,)) {
          usedResources.push(resource,);
        }
      }
    }
    const total = usedResources.length;
    let i = 0;
    for (const resource of usedResources) {
      (resource.scenarioData(scIdx,) as ResourceScenario).prepareScheduling();
      (resource.scenarioData(scIdx,) as ResourceScenario).preScheduleCheck();
      i++;
    }

    for (const resource of resources.toArray()) {
      (resource.scenarioData(scIdx,) as ResourceScenario).setDirectReports();
    }
    for (const resource of resources.toArray()) {
      (resource.scenarioData(scIdx,) as ResourceScenario).setReports();
    }

    this.computeResourceAvailabilities(scIdx, usedResources,);

    for (const task of tasks.toArray()) {
      (task.scenarioData(scIdx,) as TaskScenario).prepareScheduling();
    }
    for (const task of tasks.toArray()) {
      (task.scenarioData(scIdx,) as TaskScenario).Xref();
    }
    for (const task of tasks.toArray()) {
      (task.scenarioData(scIdx,) as TaskScenario).propagateInitialValues();
    }
    for (const task of tasks.toArray()) {
      (task.scenarioData(scIdx,) as TaskScenario).preScheduleCheck();
    }

    // Check for dependency loops in the task graph.
    for (const task of tasks.toArray()) {
      (task.scenarioData(scIdx,) as TaskScenario).resetLoopFlags();
    }
    for (const task of tasks.toArray()) {
      if (task.parent === null) {
        (task.scenarioData(scIdx,) as TaskScenario).checkForLoops(
          [],
          false,
          true,
          true,
        );
      }
    }
    for (const task of tasks.toArray()) {
      (task.scenarioData(scIdx,) as TaskScenario).resetLoopFlags();
    }
    for (const task of tasks.toArray()) {
      if (task.parent === null) {
        (task.scenarioData(scIdx,) as TaskScenario).checkForLoops(
          [],
          true,
          true,
          false,
        );
      }
    }

    // Compute the criticalness of the tasks and their pathes.
    for (const task of tasks.toArray()) {
      (task.scenarioData(scIdx,) as TaskScenario).countResourceAllocations();
    }
    for (const resource of resources.toArray()) {
      (resource.scenarioData(scIdx,) as ResourceScenario).calcCriticalness();
    }
    for (const task of tasks.toArray()) {
      (task.scenarioData(scIdx,) as TaskScenario).calcCriticalness();
    }
    for (const task of tasks.toArray()) {
      (task.scenarioData(scIdx,) as TaskScenario).calcPathCriticalness();
    }
    this.timeSheets.check();
  }

  /**
   * Runs the scheduling loop for one scenario until no task can advance.
   *
   * @param scIdx Scenario to schedule.
   * @returns `true` when a fatal scheduling condition stopped the pass.
   */
  private scheduleScenario(scIdx: number,): boolean {
    const tasks = new PropertyList(this.tasks,);
    // Only care about leaf tasks that are not milestones and aren't
    // scheduled already (marked with the 'scheduled' attribute).
    tasks.deleteIf((task,) =>
      !task.leaf() ||
      Boolean((task.scenarioData(scIdx,) as TaskScenario).a("milestone",),) ||
      Boolean((task.scenarioData(scIdx,) as TaskScenario).a("scheduled",),)
    );

    // The sorting of the work item list determines which tasks will get their
    // resources first. The first sorting criterium is the user specified task
    // priority. The second criterium is the scheduler determined priority
    // stored in the pathcriticalness attribute. That way, the user can always
    // override the scheduler determined priority. To always have a defined
    // order, the third criterium is the sequence number.
    tasks.setSorting([["priority", false, scIdx,], [
      "pathcriticalness",
      false,
      scIdx,
    ], ["seqno", true, -1,],],);
    tasks.sort();
    const totalTasks = tasks.length();

    // Enter the main scheduling loop. This loop is only terminated when all
    // tasks have been scheduled or another thread has set the breakFlag to
    // true.
    const failedTasks: unknown[] = [];
    while (tasks.length() > 0) {
      // Now find the task with the highest priority that can be scheduled
      // and schedule it.
      let taskToRemove = null;
      for (const task of tasks.toArray()) {
        // Task not ready? Ignore it.
        if (!(task.scenarioData(scIdx,) as TaskScenario).readyForScheduling()) {
          continue;
        }

        if (!(task.scenarioData(scIdx,) as TaskScenario).schedule()) {
          failedTasks.push(task,);
        }
        // The task has been completed or failed. But we can remove it from
        // the todo list.
        taskToRemove = task;
        // The scheduling of this task may cause other higher priority tasks
        // to be ready now. So we terminate the inner loop and start at the
        // top of the list again.
        break;
      }

      // There should always be a task to be removed. If not, the scheduler
      // has found a set of tasks that deadlock each other.
      //
      // RUBY-COMPAT-FIX: the three paths of `Project.rb:1225-1239` must end the
      // loop. Without the final `else`, a project in which the first scheduling
      // failure happened **and** afterwards no task became ready (e.g.
      // `Syntax/Correct/AccountReport.tjp`) spun forever — `tj3` terminates
      // with "Some tasks did not fit into the project time frame". CLI golden
      // (24.7).
      if (taskToRemove) {
        const taskIndex = tasks.itemIndex(taskToRemove,);
        tasks.delete(taskIndex,);
      } else if (failedTasks.length === 0) {
        this.warning(
          "deadlock",
          "Some tasks reference each other but don't provide " +
            "enough information to start the scheduling. The " +
            "scheduler does not know where to start scheduling " +
            "these tasks. You need to provide more fixed dates " +
            "or dependencies on already scheduled tasks.",
        );
        failedTasks.push(...tasks.toArray(),);
        break;
      } else {
        // We have some tasks that cannot be scheduled.
        break;
      }
    }

    // Check for failed tasks and report the first 10 of them as
    // warnings.
    if (failedTasks.length > 0) {
      // warning('unscheduled_tasks', "#{failedTasks.length} tasks could not be scheduled")
      // i = 0
      // failedTasks.each do |t|
      //   warning('unscheduled_task',
      //           "Task #{t.fullId}: " +
      //           "#{t['start', scIdx] ? t['start', scIdx] : '<?>'} -> " +
      //           "#{t['end', scIdx] ? t['end', scIdx] : '<?>'}",
      //           t.sourceFileInfo)

      //   i += 1
      //   break if i >= 10
      // end
      // Log.stopProgressMeter
      // return false
      return false;
    }

    // Log.stopProgressMeter
    // Log.exit('scheduleScenario', "Scheduling of scenario #{scIdx} finished")
    return true;
  }

  /**
   * Runs the bottom-up finishing pass of one scenario.
   *
   * @param scIdx Scenario being finished.
   */
  private finishScenario(scIdx: number,): void {
    for (const task of this.tasks.toArray()) {
      // Recursively traverse the top-level tasks to finish all tasks.
      if (task.parent === null) {
        (task.scenarioData(scIdx,) as TaskScenario).finishScheduling();
      }
    }

    for (const resource of this.resources.toArray()) {
      // Recursively traverse the top-level resources to finish them all.
      if (resource.parent === null) {
        (resource.scenarioData(scIdx,) as ResourceScenario).finishScheduling();
      }
    }

    let i = 0;
    const total = this.tasks.items;
    for (const task of this.tasks.toArray()) {
      if (task.parent === null) {
        (task.scenarioData(scIdx,) as TaskScenario).postScheduleCheck();
      }
      i++;
    }
  }
}
