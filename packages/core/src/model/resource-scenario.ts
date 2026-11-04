import { ScenarioData, } from "./scenario-data.ts";
import { ShiftAssignments, } from "../scheduling/shift-assignments.ts";
import { Booking, } from "../scheduling/booking.ts";
import { WorkingHours, } from "../calendar/working-hours.ts";
import { Limits, } from "../scheduling/limits.ts";
import { type PropertyLike, } from "./property-like.ts";
import { type PropertyTreeNode, } from "./property-tree-node.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";
import { Scoreboard, } from "../time/scoreboard.ts";
import { IntervalList, } from "../time/interval-list.ts";
import { ScoreboardInterval, } from "../time/scoreboard-interval.ts";
import { Task, } from "./task.ts";
import { Resource, } from "./resource.ts";
import { type Account, } from "./account.ts";
import { TjTime, } from "../time/tj-time.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { ChargeSet, } from "../finance/charge-set.ts";
import { type ProjectLike, } from "./project-like.ts";
import { CostLine, resolveAccount, } from "../accounting/attribution.ts";
import { CostEvent, createCostEvent, } from "../accounting/cost-event.ts";
import { RichText, } from "../richtext/rich-text.ts";
import { RTFHandlers, } from "../richtext/handlers/rtf-handlers.ts";
import { NotYetImplementedError, } from "./errors.ts";

/**
 * Shape of a leave entry as stored on the `leaves` attribute.
 *
 * The TS codebase does not yet have a dedicated `Leave` class (Phase 16
 * item); leaves are kept as plain objects with `interval`, `type` and
 * `reason` properties.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LeaveList.rb:Leave
 */
interface Leave {
  type: string | number;
  interval: { start: { toDate(): Date }; end: { toDate(): Date } };
  reason?: string;
  typeIdx: number;
}

/**
 * Leave type indices for scoreboard encoding.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:LEAVE_TYPES
 */
const LEAVE_TYPES: Record<string, number> = {
  unavailable: 0,
  on_leave: 1,
  sick_leave: 2,
  vacation: 3,
  unemployed: 4,
};

/**
 * Lista exata de atributos pré-carregados pelo ResourceScenario do Ruby
 * (ResourceScenario.rb, linhas 42–56).
 */
export const RESOURCE_SCENARIO_ATTRS: string[] = [
  "alloctdeffort",
  "chargeset",
  "criticalness",
  "directreports",
  "duties",
  "efficiency",
  "effort",
  "limits",
  "managers",
  "rate",
  "reports",
  "shifts",
  "leaves",
  "leaveallowances",
  "workinghours",
];

/**
 * Subconjunto estrutural de `Query` consumido pelos `query_*` de
 * ResourceScenario (Onda B3). Mesma filosofia de `account-scenario.ts`:
 * o modelo não importa a camada de queries (evita ciclo); o objeto real
 * do `Query.process` satisfaz esta forma.
 */
export interface ResourceScenarioQuery {
  readonly start: TjTime | null;
  readonly end: TjTime | null;
  readonly startIdx: number | null;
  readonly endIdx: number | null;
  scenarioIdx?: number | undefined;
  property?: PropertyTreeNode | null;
  scopeProperty?: PropertyTreeNode | null;
  costAccount?: string | null;
  revenueAccount?: string | null;
  timeFormat?: string | null;
  listItem?: string | null;
  readonly numberFormat: { format(value: number,): string } | null;
  readonly currencyFormat: { format(value: number,): string } | null;
  sortable: unknown;
  numerical: unknown;
  string: string | null;
  rti: unknown;
  scaleDuration(value: number,): string;
  scaleLoad(value: number,): string;
  assignList(items: string[],): void;
  dup(): ResourceScenarioQuery;
}

export class ResourceScenario extends ScenarioData {
  public scoreboard: Scoreboard<number | null | Task> | null = null;
  private effort: number = 0;
  private firstBookedSlot: number | null = null;
  private lastBookedSlot: number | null = null;
  private firstBookedSlots: Map<Task, number> = new Map();
  private lastBookedSlots: Map<Task, number> = new Map();
  private minslot: number | null = null;
  private maxslot: number | null = null;

  constructor(
    property: PropertyLike,
    scIdx: number,
    attributes: Map<string, AttributeBase<unknown>>,
  ) {
    super(property, scIdx, attributes,);
    this.preloadAttributes(RESOURCE_SCENARIO_ATTRS,);
  }

  project(): ProjectLike {
    return (this.getProperty() as Resource).project as ProjectLike;
  }

  /**
   * Tarefas do recurso (Ruby `@duties`).
   *
   * RUBY-COMPAT-FIX: no Ruby `@duties` **é** o valor do atributo `duties`
   * (instanciado em `ResourceScenario#initialize`), não uma lista paralela.
   * Aqui o acesso passa pelo mesmo armazenamento do atributo; do contrário o
   * `finishScheduling` — que grava os ancestrais das tarefas no atributo —
   * escreveria numa lista que `getEffectiveWork`/`getAllocatedSlots` não leem,
   * e toda alocação com escopo de tarefa-pai (container) sairia como 0.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:finishScheduling
   */
  private get duties(): Task[] {
    const stored = this.a("duties",) as Task[] | null;
    if (stored !== null) return stored;
    const created: Task[] = [];
    (this.getProperty() as PropertyTreeNode).forceForScenario(
      "duties",
      created,
      this.getScenarioIdx(),
    );
    return created;
  }

  override getProperty(): Resource {
    return super.getProperty() as Resource;
  }

  /**
   * Returns true if the resource is on shift at the time specified by
   * _sbIdx_.
   *
   * If shifts are assigned to this resource and the slot is assigned,
   * the shift's availability is checked. Otherwise, the working hours
   * are used to determine availability.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:onShift?
   */
  onShift(sbIdx: number,): boolean {
    const shifts = this.a("shifts",) as ShiftAssignments | undefined;
    if (shifts && shifts.assigned(sbIdx,)) {
      return shifts.onShift(sbIdx,);
    }
    const workinghours = this.a("workinghours",) as WorkingHours | undefined;
    if (workinghours) {
      return workinghours.onShift(sbIdx,);
    }
    return true;
  }

  /**
   * This method must be called at the beginning of each scheduling run. It
   * initializes variables used during the scheduling process.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:prepareScheduling
   */
  prepareScheduling(): void {
    this.effort = 0;
    if ((this.getProperty() as PropertyTreeNode).leaf?.()) {
      this.initScoreboard();
    }
  }

  /**
   * The criticalness of a resource is a measure for the probability that all
   * allocations can be fulfilled. The smaller the value, the more likely
   * will the tasks get the resource. A value above 1.0 means that
   * statistically some tasks will not get their resources. A value between
   * 0 and 1 implies no guarantee, though.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:calcCriticalness
   */
  calcCriticalness(): void {
    if (this.scoreboard === null) {
      // Resources that are not allocated are not critical at all.
      this.setStoredValue("criticalness", 0.0,);
      return;
    }
    let freeSlots = 0;
    for (let i = 0; i < this.scoreboard.size; i++) {
      if (this.scoreboard.get(i,) === null) {
        freeSlots++;
      }
    }
    const alloctdeffort = (this.a("alloctdeffort",) as number) ?? 0;
    this.setStoredValue(
      "criticalness",
      freeSlots === 0 ? 1.0 : alloctdeffort / freeSlots,
    );
  }

  /**
   * Resolves the `managers` attribute into `Resource` objects and builds the
   * reverse `directreports` link.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:setDirectReports
   */
  setDirectReports(): void {
    const managers = (this.a("managers",) as string[]) ?? [];
    const property = this.getProperty() as PropertyTreeNode;
    const resolved: Resource[] = [];

    for (const managerId of managers) {
      const manager = this.project().resource(managerId,);
      if (!manager) {
        this.error(
          "resource_id_expected",
          `${managerId} is not a defined resource.`,
        );
        continue;
      }
      if (!(manager as PropertyTreeNode).leaf?.()) {
        this.error(
          "manager_is_group",
          `Resource ${property.fullId} has group ${manager.fullId} ` +
            `assigned as manager. Managers must be leaf resources.`,
        );
        continue;
      }
      if (manager === property) {
        this.error(
          "manager_is_self",
          `Resource ${property.fullId} cannot manage itself.`,
        );
        continue;
      }

      // Only leaf resources have reporting lines.
      if (property.leaf?.()) {
        const managerDirectReports = (manager as PropertyTreeNode)
          .getForScenario(
            "directreports",
            this.getScenarioIdx(),
          ) as Resource[];
        if (!managerDirectReports.includes(property as unknown as Resource,)) {
          (manager as PropertyTreeNode).setForScenario(
            "directreports",
            [...managerDirectReports, property as unknown as Resource,],
            this.getScenarioIdx(),
          );
        }
      }

      resolved.push(manager,);
    }

    // @managers.uniq!
    this.setStoredValue("managers", resolved,);
  }

  /**
   * Propagates this resource into the `reports` list of its managers.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:setReports
   */
  setReports(): void {
    const directReports = (this.a("directreports",) as Resource[]) ?? [];
    if (directReports.length === 0) {
      return;
    }

    const property = this.getProperty() as PropertyTreeNode;
    for (const manager of directReports) {
      const managerNode = manager as unknown as PropertyTreeNode;
      const reports = (managerNode.getForScenario(
        "reports",
        this.getScenarioIdx(),
      ) as Resource[]) ?? [];
      if (!reports.includes(property as unknown as Resource,)) {
        managerNode.setForScenario(
          "reports",
          [...reports, property as unknown as Resource,],
          this.getScenarioIdx(),
        );
      }
    }
  }

  /**
   * Hook for resource specific consistency checks before the scheduling run.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:preScheduleCheck
   */
  preScheduleCheck(): void {}

  /**
   * Housekeeping after the scheduling run. Meant to be called for top-level
   * resources, it then recursively descends into all child resources.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:finishScheduling
   */
  finishScheduling(): void {
    const property = this.getProperty() as PropertyTreeNode;

    for (const child of property.kids()) {
      (child as Resource).scenarioData(this.getScenarioIdx(),)
        .finishScheduling();
    }

    // Add the parent tasks of each task to the duties list.
    const duties = this.duties;
    for (const task of duties) {
      for (const pTask of task.ancestors(true,)) {
        if (!duties.includes(pTask as Task,)) {
          duties.push(pTask as Task,);
        }
      }
    }

    // Add the assigned task to the parent(s) resource duties list.
    for (const pResource of property.parents()) {
      const pDuties = (pResource.getForScenario(
        "duties",
        this.getScenarioIdx(),
      ) as Task[]) ?? [];
      for (const task of duties) {
        if (!pDuties.includes(task,)) {
          pDuties.push(task,);
        }
      }
      pResource.setForScenario(
        "duties",
        pDuties,
        this.getScenarioIdx(),
      );
    }
  }

  /**
   * Runs the user defined `fail`/`warn` checks of this resource.
   *
   * The expression evaluation is provided by the query engine (Phase 11), so
   * only the presence of the attributes is verified for now.
   *
   * @see docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb:checkFailsAndWarnings
   */
  checkFailsAndWarnings(): void {
    const property = this.getProperty() as PropertyTreeNode;
    for (const attrId of ["fail", "warn",]) {
      // fail/warn are non-scenario attributes (Project.rb:219/411:
      // isScenarioAttribute=false). Ruby's checkFailsAndWarnings reads
      // @attributes['fail'] directly, never the scenario attributes.
      const attr = property.getAttribute(attrId,);
      if (!attr) {
        continue;
      }
      this.warning(
        `${attrId}_check_unsupported`,
        `User defined ${attrId} check for resource ${property.fullId} ` +
          `cannot be evaluated yet (requires the query engine).`,
      );
    }
  }

  /**
   * Returns true if the resource is available at the time specified by
   * _sbIdx_.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:available?
   */
  available(sbIdx: number,): boolean {
    // Ruby: `@scoreboard[sbIdx].nil?` — when the scoreboard is nil,
    // `@scoreboard[sbIdx]` returns nil, so the slot is considered available.
    if (this.scoreboard !== null) {
      const slot = this.scoreboard.get(sbIdx,);
      if (slot !== null) {
        return false;
      }
    }
    const limits = this.a("limits",) as Limits | undefined;
    if (limits) {
      return limits.ok(sbIdx, true, this.getProperty() as Resource,);
    }
    return true;
  }

  /**
   * Returns true if the resource is booked for a tasks at the time specified by
   * _sbIdx_.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:booked?
   */
  booked(sbIdx: number,): boolean {
    if (this.scoreboard === null) {
      return false;
    }
    const slot = this.scoreboard.get(sbIdx,);
    return slot instanceof Task;
  }

  /**
   * Return the Task that this resource is booked for at the time specified
   * by _sbIdx_. If not booked to a task, nil is returned.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:bookedTask
   */
  bookedTask(sbIdx: number,): Task | null {
    if (this.scoreboard === null) {
      return null;
    }
    const slot = this.scoreboard.get(sbIdx,);
    if (slot instanceof Task) {
      return slot;
    }
    return null;
  }

  /**
   * Book the slot indicated by the scoreboard index +sbIdx+ for Task +task+.
   * If +force+ is true, overwrite the existing booking for this slot. The
   * method returns true if the slot was available.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:book
   */
  book(sbIdx: number, task: Task, force: boolean = false,): boolean {
    if (!force && !this.available(sbIdx,)) {
      return false;
    }

    // Make sure the task is in the list of duties.
    if (!this.duties.includes(task,)) {
      this.duties.push(task,);
    }

    // Lazy initialization of scoreboard (Ruby: scoreboard is initialized earlier)
    if (this.scoreboard === null) {
      this.initScoreboard();
    }
    this.scoreboard!.set(sbIdx, task,);
    const efficiency = (this.a("efficiency",) as number) ?? 1;
    this.effort += efficiency;

    const limits = this.a("limits",) as Limits | undefined;
    if (limits) {
      limits.inc(sbIdx, this.getProperty() as Resource,);
    }
    task.scenarioData(this.getScenarioIdx(),).incLimits(
      sbIdx,
      this.getProperty() as Resource,
    );

    // Track first/last booked slots (all tasks)
    if (this.firstBookedSlot === null || this.firstBookedSlot > sbIdx) {
      this.firstBookedSlot = sbIdx;
    }
    if (this.lastBookedSlot === null || this.lastBookedSlot < sbIdx) {
      this.lastBookedSlot = sbIdx;
    }

    // Track first/last booked slots per task
    const taskFirst = this.firstBookedSlots.get(task,);
    if (taskFirst === undefined || taskFirst > sbIdx) {
      this.firstBookedSlots.set(task, sbIdx,);
    }
    const taskLast = this.lastBookedSlots.get(task,);
    if (taskLast === undefined || taskLast < sbIdx) {
      this.lastBookedSlots.set(task, sbIdx,);
    }

    return true;
  }

  /**
   * Register the user provided bookings with the Resource scoreboards. A
   * booking describes the assignment of a Resource to a certain Task for a
   * specified TimeInterval.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:bookBooking
   */
  bookBooking(sbIdx: number, booking: Booking,): boolean {
    if (this.scoreboard === null) {
      this.initScoreboard();
    }
    const sb = this.scoreboard!;

    const slot = sb.get(sbIdx,);
    if (slot !== null) {
      if (this.booked(sbIdx,)) {
        this.error(
          "booking_conflict",
          `Resource ${
            (this.getProperty() as PropertyTreeNode).fullId
          } has multiple conflicting ` +
            `bookings for ${sb.idxToDate(sbIdx,)}. The ` +
            `conflicting tasks are ${sb.get(sbIdx,)} and ` +
            `${booking.task.fullId}.`,
          booking.sourceFileInfo,
        );
      }
      const val = sb.get(sbIdx,);
      if (typeof val === "number") {
        if ((val & 2) !== 0 && booking.overtime < 1) {
          if (booking.sloppy < 1) {
            this.error(
              "booking_no_duty",
              `Resource ${
                (this.getProperty() as PropertyTreeNode).fullId
              } has no duty at ` +
                `${sb.idxToDate(sbIdx,)}.`,
              booking.sourceFileInfo,
            );
          }
          return false;
        }
        if ((val & 0x3C) !== 0 && booking.overtime < 2) {
          if (booking.sloppy < 2) {
            this.error(
              "booking_on_vacation",
              `Resource ${
                (this.getProperty() as PropertyTreeNode).fullId
              } is on vacation at ` +
                `${sb.idxToDate(sbIdx,)}.`,
              booking.sourceFileInfo,
            );
          }
          return false;
        }
      }
    }

    return this.book(sbIdx, booking.task, true,);
  }

  /**
   * @effort only tracks the already allocated effort for leaf resources. It's
   * too expensive to propagate this to the group resources on every booking.
   * If a value for a group effort is needed, it's computed here.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:bookedEffort
   */
  bookedEffort(): number {
    if ((this.getProperty() as PropertyTreeNode).container?.()) {
      let effort = 0;
      for (const child of (this.getProperty() as PropertyTreeNode).kids()) {
        effort += (child as Resource).scenarioData(this.getScenarioIdx(),)
          .bookedEffort();
      }
      return effort;
    }
    return this.effort;
  }

  /**
   * Sets the booked effort for this resource (for testing).
   */
  setEffort(value: number,): void {
    this.effort = value;
  }

  /**
   * Returns the number of leave days for the period described by _startIdx_
   * and _endIdx_ for the given _type_ of leave.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getLeave
   */
  getLeave(startIdx: number, endIdx: number, type: number | string,): number {
    return this.treeSum(startIdx, endIdx, type, () => {
      const project = (this.getProperty() as PropertyTreeNode).project;
      const granularity = project.get("scheduleGranularity",) as number;
      const dailyWorkingHours = (project.get("dailyWorkingHours",) as number) ??
        8;
      return (granularity * this.getLeaveSlots(startIdx, endIdx, type,)) /
        (dailyWorkingHours * 3600);
    },);
  }

  /**
   * Returns the work of the resource (and its children) weighted by their
   * efficiency. If _task_ is provided, only the work for this task and all
   * its sub tasks are being counted.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getEffectiveWork
   */
  getEffectiveWork(
    startIdx: number,
    endIdx: number,
    task: Task | null = null,
  ): number {
    // Make sure we have the real Task and not a proxy.
    if (task && task.ptn()) {
      task = task.ptn() as Task;
    }
    // There can't be any effective work if the start is after the end or the
    // duties list doesn't contain the specified task.
    if (startIdx >= endIdx || (task && !this.duties.includes(task,))) {
      return 0.0;
    }

    const project = (this.getProperty() as PropertyTreeNode).project;
    const granularity = project.get("scheduleGranularity",) as number;
    const efficiency = (this.a("efficiency",) as number) ?? 1;
    const dailyWorkingHours = (project.get("dailyWorkingHours",) as number) ??
      8;

    if ((this.getProperty() as PropertyTreeNode).container?.()) {
      let work = 0.0;
      for (const child of (this.getProperty() as PropertyTreeNode).kids()) {
        work += (child as Resource).scenarioData(this.getScenarioIdx(),)
          .getEffectiveWork(
            startIdx,
            endIdx,
            task,
          );
      }
      return work;
    }

    if (this.scoreboard === null) {
      return 0.0;
    }

    const allocatedSlots = this.getAllocatedSlots(startIdx, endIdx, task,);
    return ((granularity * allocatedSlots) / (dailyWorkingHours * 3600)) *
      efficiency;
  }

  /**
   * Returns the allocated accumulated time of this resource and its children.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getAllocatedTime
   */
  getAllocatedTime(
    startIdx: number,
    endIdx: number,
    task: Task | null = null,
  ): number {
    return this.treeSum(startIdx, endIdx, task, () => {
      if (this.scoreboard === null) {
        return 0;
      }
      const project = (this.getProperty() as PropertyTreeNode).project;
      const granularity = project.get("scheduleGranularity",) as number;
      const dailyWorkingHours = (project.get("dailyWorkingHours",) as number) ??
        8;
      return (granularity * this.getAllocatedSlots(startIdx, endIdx, task,)) /
        (dailyWorkingHours * 3600);
    },);
  }

  /**
   * Return the unallocated work time (in seconds) of the resource and its
   * children.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getEffectiveFreeTime
   */
  getEffectiveFreeTime(startIdx: number, endIdx: number,): number {
    return this.treeSum(startIdx, endIdx, null, () => {
      const project = (this.getProperty() as PropertyTreeNode).project;
      const granularity = project.get("scheduleGranularity",) as number;
      return this.getFreeSlots(startIdx, endIdx,) * granularity;
    },);
  }

  /**
   * Return the unallocated work of the resource and its children weighted by
   * their efficiency.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getEffectiveFreeWork
   */
  getEffectiveFreeWork(startIdx: number, endIdx: number,): number {
    return this.treeSum(startIdx, endIdx, null, () => {
      const project = (this.getProperty() as PropertyTreeNode).project;
      const granularity = project.get("scheduleGranularity",) as number;
      const efficiency = (this.a("efficiency",) as number) ?? 1;
      const dailyWorkingHours = (project.get("dailyWorkingHours",) as number) ??
        8;
      return ((granularity * this.getFreeSlots(startIdx, endIdx,)) /
        (dailyWorkingHours * 3600)) * efficiency;
    },);
  }

  /**
   * Intervalos do scoreboard com duração mínima `minDuration` que contêm
   * apenas slots fora de serviço/leave (máscara `0x3E`).
   *
   * Só recursos folha têm tempo fora relevante: grupos caem nas horas globais.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb#collectTimeOffIntervals
   */
  collectTimeOffIntervals(
    iv: TimeInterval,
    minDuration: number,
  ): IntervalList<TimeInterval> {
    if (!(this.getProperty() as PropertyTreeNode).leaf()) {
      return new IntervalList<TimeInterval>();
    }
    if (this.scoreboard === null) this.initScoreboard();
    return this.scoreboard!.collectIntervals(
      iv,
      minDuration,
      (v,) => typeof v === "number" && (v & 0x3E) !== 0,
    );
  }

  /**
   * Return the number of working days that are blocked by leaves.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getTimeOffDays
   */
  getTimeOffDays(startIdx: number, endIdx: number,): number {
    return this.treeSum(startIdx, endIdx, null, () => {
      const project = (this.getProperty() as PropertyTreeNode).project;
      const granularity = project.get("scheduleGranularity",) as number;
      const efficiency = (this.a("efficiency",) as number) ?? 1;
      const dailyWorkingHours = (project.get("dailyWorkingHours",) as number) ??
        8;
      return ((granularity * this.getTimeOffSlots(startIdx, endIdx,)) /
        (dailyWorkingHours * 3600)) * efficiency;
    },);
  }

  /**
   * Returns the first booked slot index for this resource.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:firstBookedSlot
   */
  getMinSlot(): number | null {
    if (this.scoreboard === null) {
      this.initScoreboard();
    }
    return this.minslot;
  }

  /**
   * Returns the last booked slot index for this resource.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:lastBookedSlot
   */
  getMaxSlot(): number | null {
    if (this.scoreboard === null) {
      this.initScoreboard();
    }
    return this.maxslot;
  }

  /**
   * Alocado? Verdadeiro se `task` tem slots de agenda dentro de `iv` neste
   * recurso (ou nos seus filhos).
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:allocated?
   */
  allocated(iv: TimeInterval, task: Task | null = null,): boolean {
    if (task && !this.duties.includes(task,)) return false;

    const project = this.getProperty().project as ProjectLike;
    let startIdx = project.dateToIdx(iv.start,);
    let endIdx = project.dateToIdx(iv.end,);
    [startIdx, endIdx,] = this.fitIndicies(startIdx, endIdx, task,);
    return startIdx < endIdx && this.allocatedSub(startIdx, endIdx, task,);
  }

  /**
   * Varre o scoreboard: em contêineres, qualquer filho alocado; em folhas,
   * algum slot igual a `task`.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:allocatedSub
   */
  allocatedSub(startIdx: number, endIdx: number, task: Task | null,): boolean {
    const property = this.getProperty();
    if (property.container()) {
      for (const kid of property.kids()) {
        const kidSc = (kid as Resource).scenarioData(this.scenarioIdx,);
        if (kidSc.allocatedSub(startIdx, endIdx, task,)) return true;
      }
    } else {
      if (!this.scoreboard || !task || !this.duties.includes(task,)) {
        return false;
      }
      let [s, e,] = this.fitIndicies(startIdx, endIdx, task,);
      if (s >= e) return false;
      for (; s < e; s++) {
        if (this.scoreboard.get(s,) === task) return true;
      }
    }
    return false;
  }

  /**
   * Collect the bookings of this resource, hashed by task (`hashByTask`) or as
   * a flat array of `Booking`. Rebuilds contiguous booking intervals by
   * scanning the scoreboard between the first and last booked slots, optionally
   * clipped to `iv`.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getBookings
   */
  getBookings(
    iv: TimeInterval | null = null,
    hashByTask = true,
  ): Map<Task, Booking> | Booking[] {
    const bookings: Map<Task, Booking> | Booking[] = hashByTask
      ? new Map()
      : [];
    const property = this.getProperty() as PropertyTreeNode;
    if (
      property.container() || this.scoreboard === null ||
      this.firstBookedSlot === null || this.lastBookedSlot === null
    ) {
      return bookings;
    }

    const sb = this.scoreboard;
    let startIdx = this.firstBookedSlot;
    let endIdx = this.lastBookedSlot + 1;

    const project = property.project;
    if (iv) {
      const ivStartIdx = project.dateToIdx(iv.start,);
      const ivEndIdx = project.dateToIdx(iv.end,);
      if (ivStartIdx > startIdx) startIdx = ivStartIdx;
      if (ivEndIdx < endIdx) endIdx = ivEndIdx;
    }

    const appendInterval = (booking: Booking, from: number, to: number,) => {
      // Ruby (ResourceScenario.rb:705): os intervalos reconstruídos são
      // `TimeInterval`s de datas — não `ScoreboardInterval` (que carrega
      // índices). `Booking#to_tjp` e o scheduling esperam datas.
      booking.intervals.push(
        new TimeInterval(sb.idxToDate(from,), sb.idxToDate(to,),),
      );
    };

    let lastTask: Task | null = null;
    let bookingStart: number | null = null;

    for (let idx = startIdx; idx <= endIdx; idx++) {
      const slot = sb.get(idx,);
      const task = slot instanceof Task ? slot : null;
      const isTaskSlot = slot instanceof Task;
      if (
        task !== lastTask ||
        (isTaskSlot && (lastTask === null || idx === endIdx))
      ) {
        if (lastTask) {
          if (hashByTask) {
            const map = bookings as Map<Task, Booking>;
            let booking = map.get(lastTask,);
            if (!booking) {
              booking = new Booking(
                property as Resource,
                lastTask,
                [],
              );
              map.set(lastTask, booking,);
            }
            appendInterval(booking, bookingStart!, idx,);
          } else {
            const arr = bookings as Booking[];
            const last = arr.length > 0 ? arr[arr.length - 1] : undefined;
            if (!last || last.task !== lastTask) {
              const nb = new Booking(
                property as Resource,
                lastTask,
                [],
              );
              arr.push(nb,);
              appendInterval(nb, bookingStart!, idx,);
            } else {
              appendInterval(last, bookingStart!, idx,);
            }
          }
        }
        if (isTaskSlot) {
          lastTask = task;
          bookingStart = idx;
        } else {
          lastTask = null;
          bookingStart = null;
        }
      }
    }
    return bookings;
  }

  /**
   * Initializes the scoreboard for this resource.
   *
   * Creates a scoreboard and marks all slots as non-working-time,
   * then changes working time slots to nil (available), marks global
   * leaves, resource-specific leaves, and shift leaves.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:initScoreboard
   */
  initScoreboard(): void {
    const project = (this.getProperty() as PropertyTreeNode).project;
    const start = project.get("start",) as TjTime;
    const end = project.get("end",) as TjTime;
    const granularity = project.get("scheduleGranularity",) as number;

    // Create scoreboard and mark all slots as non-working-time (BIT_OFF_WORK = 2).
    this.scoreboard = new Scoreboard<number | null | Task>(
      start.toDate(),
      end.toDate(),
      granularity,
      2,
    );

    // Change all work time slots to nil (available) again.
    const size = project.get("scoreboardSize",) as number ??
      this.scoreboard.size;
    for (let i = 0; i < size; i++) {
      if (this.onShiftCheck(i,)) {
        this.scoreboard.set(i, null,);
      }
    }

    // Mark all global leave slots
    const leaves = this.a("leaves",) as Leave[];
    if (leaves) {
      for (const leave of leaves) {
        const startIdx = this.scoreboard.dateToIdx(
          leave.interval.start.toDate(),
        );
        const endIdx = this.scoreboard.dateToIdx(leave.interval.end.toDate(),);
        for (let i = startIdx; i < endIdx; i++) {
          const sb = this.scoreboard.get(i,);
          // Preserve the work-time bit (#1).
          this.scoreboard.set(i, (sb === null ? 0 : 2) | (leave.typeIdx << 2),);
        }
      }
    }

    // Mark all resource-specific leave slots
    const resLeaves = this.a("leaves",) as Leave[];
    if (resLeaves) {
      for (const leave of resLeaves) {
        const startIdx = this.scoreboard!.dateToIdx(
          leave.interval.start.toDate(),
        );
        const endIdx = this.scoreboard!.dateToIdx(leave.interval.end.toDate(),);
        for (let i = startIdx; i < endIdx; i++) {
          const sb = this.scoreboard!.get(i,);
          if (sb !== null && typeof sb === "number") {
            // The slot is already marked as non-working slot. Override leave type
            // if the new type is larger than the old one.
            const leaveIdx = (sb & 0x3C) >> 2;
            if (leave.typeIdx > leaveIdx) {
              this.scoreboard!.set(i, (sb & 0x2) | (leave.typeIdx << 2),);
            }
          } else {
            // Mark a working time slot as a leave slot.
            this.scoreboard!.set(i, leave.typeIdx << 2,);
          }
        }
      }
    }

    // Apply shift leaves
    const shifts = this.a("shifts",) as ShiftAssignments | undefined;
    if (shifts) {
      for (let i = 0; i < size; i++) {
        const v = shifts.getSbSlot(i,);
        if (!v) continue;

        if ((v & (1 << 8)) !== 0) {
          // Override bit set: copy whole interval to resource scoreboard
          this.scoreboard!.set(i, (v & 0x3E) === 0 ? null : (v & 0x3D),);
        } else if (
          (this.scoreboard!.get(i,) === null ||
            ((this.scoreboard!.get(i,) as number & 0x3C) < (v & 0x3C))) &&
          (v & 0x3C) !== 0
        ) {
          // Merge mode: add shift leaves with higher type index or unassigned slots
          this.scoreboard!.set(i, v & 0x3E,);
        }
      }
    }

    // Set minimum and maximum availability
    let idx = 0;
    while (idx < this.scoreboard.size) {
      if (this.available(idx,)) {
        this.minslot = idx;
        break;
      }
      idx++;
    }
    idx = this.scoreboard.size - 1;
    while (idx >= 0) {
      if (this.available(idx,)) {
        this.maxslot = idx;
        break;
      }
      idx--;
    }
  }

  /**
   * Generic slot counter for the scoreboard.
   */
  private countSlots(
    startIdx: number,
    endIdx: number,
    predicate: (val: number | null | Task,) => boolean,
  ): number {
    if (startIdx >= endIdx) return 0;
    if (this.scoreboard === null) {
      this.initScoreboard();
    }
    let slots = 0;
    for (let i = startIdx; i < endIdx; i++) {
      if (predicate(this.scoreboard!.get(i,),)) {
        slots++;
      }
    }
    return slots;
  }

  /**
   * Count booked slots between startIdx and endIdx. If task is provided,
   * only count slots assigned to that task or its sub-tasks.
   */
  getAllocatedSlots(
    startIdx: number,
    endIdx: number,
    task: Task | null = null,
  ): number {
    if (this.scoreboard === null) return 0;

    [startIdx, endIdx,] = this.fitIndicies(startIdx, endIdx, task,);
    if (startIdx >= endIdx) return 0;

    const taskList = task ? task.all() : [];
    return this.countSlots(startIdx, endIdx, (slot,) => {
      if (!(slot instanceof Task)) return false;
      return task === null || taskList.includes(slot,);
    },);
  }

  /**
   * Count free slots between startIdx and endIdx.
   */
  getFreeSlots(startIdx: number, endIdx: number,): number {
    return this.countSlots(startIdx, endIdx, (val,) => val === null,);
  }

  /**
   * Count leave slots of a specific type between startIdx and endIdx.
   */
  getLeaveSlots(
    startIdx: number,
    endIdx: number,
    type: number | string,
  ): number {
    const leaveType = typeof type === "string" ? LEAVE_TYPES[type]! : type;
    return this.countSlots(
      startIdx,
      endIdx,
      (val,) => typeof val === "number" && (val & 0x3E) === (leaveType << 2),
    );
  }

  /**
   * Count time-off slots (working time blocked by leaves) between startIdx and endIdx.
   */
  getTimeOffSlots(startIdx: number, endIdx: number,): number {
    return this.countSlots(
      startIdx,
      endIdx,
      (val,) =>
        typeof val === "number" && (val & 0x2) === 0 && (val & 0x3C) !== 0,
    );
  }

  /**
   * Limit the startIdx and endIdx to the actually assigned interval.
   * If task is provided, fit it for the bookings of this particular task.
   */
  private fitIndicies(
    startIdx: number,
    endIdx: number,
    task: Task | null = null,
  ): [number, number,] {
    if (task) {
      const taskFirst = this.firstBookedSlots.get(task,);
      if (taskFirst !== undefined && startIdx < taskFirst) {
        startIdx = taskFirst;
      }
      const taskLast = this.lastBookedSlots.get(task,);
      if (taskLast !== undefined && endIdx > taskLast + 1) {
        endIdx = taskLast + 1;
      }
    } else {
      if (this.firstBookedSlot !== null && startIdx < this.firstBookedSlot) {
        startIdx = this.firstBookedSlot;
      }
      if (this.lastBookedSlot !== null && endIdx > this.lastBookedSlot + 1) {
        endIdx = this.lastBookedSlot + 1;
      }
    }
    return [startIdx, endIdx,];
  }

  /**
   * Generic tree iterator that recursively accumulates the result of the
   * block for each leaf object.
   */
  private treeSum<T,>(
    startIdx: number,
    endIdx: number,
    arg: T,
    block: () => number,
  ): number {
    const cacheTag = `ResourceScenario#treeSum`;
    return this.treeSumR(cacheTag, startIdx, endIdx, arg, block,);
  }

  private treeSumR<T,>(
    cacheTag: string,
    startIdx: number,
    endIdx: number,
    arg: T,
    block: () => number,
  ): number {
    if ((this.getProperty() as PropertyTreeNode).container?.()) {
      let sum = 0.0;
      for (const child of (this.getProperty() as PropertyTreeNode).kids()) {
        sum += (child as Resource).scenarioData(this.getScenarioIdx(),)
          .treeSumR(
            cacheTag,
            startIdx,
            endIdx,
            arg,
            block,
          );
      }
      return sum;
    } else {
      return block();
    }
  }

  /**
   * Returns true if the resource is on shift at the time specified by
   * _sbIdx_.
   *
   * If shifts are assigned to this resource and the slot is assigned,
   * the shift's availability is checked. Otherwise, the working hours
   * are used to determine availability.
   */
  private onShiftCheck(sbIdx: number,): boolean {
    const shifts = this.a("shifts",) as ShiftAssignments | undefined;
    if (shifts && shifts.assigned(sbIdx,)) {
      return shifts.onShift(sbIdx,);
    }
    const workinghours = this.a("workinghours",) as WorkingHours | undefined;
    if (workinghours) {
      return workinghours.onShift(sbIdx,);
    }
    return true;
  }

  /**
   * Returns true if the resource is employed at the given slot.
   */
  private employed(sbIdx: number,): boolean {
    if (this.scoreboard === null) {
      this.initScoreboard();
    }
    const val = this.scoreboard!.get(sbIdx,);
    if (typeof val !== "number") return true;

    const leaveType = (val >> 2) & 0xF;
    const unemployedType = LEAVE_TYPES["unemployed"];
    if (unemployedType === undefined) return true;
    return leaveType < unemployedType;
  }

  /**
   * Returns the daily cost/rate of a resource or resource group.
   */
  rate(): number {
    if ((this.getProperty() as PropertyTreeNode).container?.()) {
      let dailyRate = 0.0;
      for (const child of (this.getProperty() as PropertyTreeNode).kids()) {
        dailyRate += (child as Resource).scenarioData(this.getScenarioIdx(),)
          .rate();
      }
      return dailyRate;
    }
    return (this.a("rate",) as number) ?? 0;
  }

  /**
   * Compute the turnover (cost or revenue) for this resource.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:turnover
   */
  turnover(
    startIdx: number,
    endIdx: number,
    account: Account,
    task: Task | null = null,
    includeKids: boolean = false,
  ): number {
    let amount = 0.0;
    if ((this.getProperty() as PropertyTreeNode).container?.() && includeKids) {
      for (const child of (this.getProperty() as PropertyTreeNode).kids()) {
        amount += (child as Resource).scenarioData(this.getScenarioIdx(),)
          .turnover(
            startIdx,
            endIdx,
            account,
            task,
          );
      }
    } else {
      if (task) {
        amount += (task as Task).scenarioData(this.getScenarioIdx(),).turnover(
          startIdx,
          endIdx,
          account,
          this.getProperty() as Resource,
        );
      } else if (!this.isChargesetEmpty()) {
        const totalResourceCost = this.cost(startIdx, endIdx,);
        const chargeset = this.a("chargeset",) as ChargeSet[];
        if (chargeset) {
          for (const set of chargeset) {
            set.each((accnt, share,) => {
              if (
                share !== null &&
                share > 0.0 &&
                (accnt === account || accnt.isChildOf(account,))
              ) {
                amount += totalResourceCost * share;
              }
            },);
          }
        }
      }
    }

    // Bloco I: Integração com motor de atribuição (attribution engine)
    // Calcula linhas de custo e emite CostEvents para auditoria
    const resource = this.getProperty() as Resource;
    const scIdx = this.getScenarioIdx();
    const project = resource.project as ProjectLike;

    // Determinar se há chargeset disponível para atribuição
    const hasChargeset = this.a("chargeset",) as ChargeSet[];

    // 1. Linhas de custo de recursos (resource_effort)
    if (!task && hasChargeset && hasChargeset.length > 0) {
      const resourceCost = this.cost(startIdx, endIdx,);
      if (resourceCost > 0) {
        const line: CostLine = {
          type: "resource_effort",
          amount: resourceCost,
          resource: resource,
          // Regra 4 (`defaultaccount`, 14C.9): o projeto fornece a conta
          // default quando não há chargeset da origem nem da tarefa.
          project: project,
        };
        const attribution = resolveAccount(line,);
        // Emitir CostEvent
        const costEvent = createCostEvent(
          line,
          attribution.account,
          attribution.rule,
          scIdx,
          "planned", // modo planejado por default
        );
        project.costEvents.push(costEvent,);
        // Se a conta resolvida corresponde à conta solicitada, adicionar ao total
        if (
          attribution.account &&
          (attribution.account === account ||
            (attribution.account as Account).isChildOf(account,))
        ) {
          amount += resourceCost;
        }
      }
    }

    return amount;
  }

  /**
   * Returns the cost for using this resource during the specified interval.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:cost
   */
  cost(startIdx: number, endIdx: number, task: Task | null = null,): number {
    // Ruby uses @rate (the raw rate attribute), not the container-summing
    // rate() method, so a group resource's own rate is used directly.
    return this.getAllocatedTime(startIdx, endIdx, task,) *
      (this.a("rate",) as number);
  }

  /**
   * Check if the chargeset is empty.
   */
  private isChargesetEmpty(): boolean {
    const chargeset = this.a("chargeset",) as ChargeSet[] | undefined;
    if (!chargeset) return true;
    let empty = true;
    for (const set of chargeset) {
      set.each((_, share,) => {
        if (share !== null && share > 0.0) {
          empty = false;
        }
      },);
    }
    return empty;
  }

  // ==================================================================
  // Onda B3 — query_* portáveis de ResourceScenario (Ruby l.315-463).
  //
  // Subconjunto central apoiado em bookings/scoreboard/finance já portados.
  // Os `query_*` de leave/fte/dashboard ficam ancorados na Onda B4.
  // ==================================================================

  /** Projeto com helpers além de `ProjectLike` (para dateToIdx force). */
  private projExt(): {
    dateToIdx(date: TjTime, forceIntoProject?: boolean,): number;
    get(name: string,): unknown;
    accounts: { get(id: string,): unknown };
  } {
    return this.project() as unknown as {
      dateToIdx(date: TjTime, forceIntoProject?: boolean,): number;
      get(name: string,): unknown;
      accounts: { get(id: string,): unknown };
    };
  }

  /** Handlers RTF para o ramo `listItem` de `query_duties`. */
  private rtfHandlers(): ReturnType<typeof RTFHandlers.create> {
    return RTFHandlers.create(
      this.project() as unknown as Parameters<typeof RTFHandlers.create>[0],
    );
  }

  query_cost(query: ResourceScenarioQuery,): void {
    const account = query.costAccount
      ? (this.projExt().accounts.get(query.costAccount,) as Account | null)
      : null;
    if (account) {
      const cost = this.turnover(
        query.startIdx ?? 0,
        query.endIdx ?? 0,
        account,
        query.scopeProperty as Task | null,
        true,
      );
      query.sortable = query.numerical = cost;
      query.string = query.currencyFormat
        ? query.currencyFormat.format(cost,)
        : String(cost,);
    } else {
      query.string = "No 'balance' defined!";
    }
  }

  query_duties(query: ResourceScenarioQuery,): void {
    const list: string[] = [];
    const iv = new TimeInterval(query.start as TjTime, query.end as TjTime,);
    const resource = this.getProperty();
    for (const task of this.duties) {
      if (!task.hasResourceAllocated(this.getScenarioIdx(), iv, resource,)) {
        continue;
      }
      if (query.listItem) {
        const rti = new RichText(query.listItem, this.rtfHandlers(),)
          .generateIntermediateFormat();
        if (rti) {
          const q = query.dup();
          q.property = task;
          q.scopeProperty = resource;
          (rti as unknown as { setQuery(q: unknown,): void }).setQuery(q,);
          list.push(
            `<nowiki>${(rti as unknown as { to_s(): string }).to_s()}</nowiki>`,
          );
          continue;
        }
      }
      list.push(`<nowiki>${task.name} (${task.id})</nowiki>`,);
    }
    query.assignList(list,);
  }

  query_effort(query: ResourceScenarioQuery,): void {
    const effort = this.getEffectiveWork(
      query.startIdx ?? 0,
      query.endIdx ?? 0,
      query.scopeProperty as Task | null,
    );
    query.sortable = query.numerical = effort;
    query.string = query.scaleLoad(effort,);
  }

  query_effortdone(query: ResourceScenarioQuery,): void {
    const p = this.projExt();
    const effort = this.getEffectiveWork(
      p.dateToIdx(this.project().get("start",) as TjTime, false,),
      p.dateToIdx(this.project().get("now",) as TjTime,),
      query.scopeProperty as Task | null,
    );
    query.sortable = query.numerical = effort;
    query.string = query.scaleLoad(effort,);
  }

  query_effortleft(query: ResourceScenarioQuery,): void {
    const p = this.projExt();
    const effort = this.getEffectiveWork(
      p.dateToIdx(this.project().get("now",) as TjTime,),
      p.dateToIdx(this.project().get("end",) as TjTime, false,),
      query.scopeProperty as Task | null,
    );
    query.sortable = query.numerical = effort;
    query.string = query.scaleLoad(effort,);
  }

  query_freetime(query: ResourceScenarioQuery,): void {
    const time =
      this.getEffectiveFreeTime(query.startIdx ?? 0, query.endIdx ?? 0,) /
      (60 * 60 * 24);
    query.sortable = query.numerical = time;
    query.string = query.scaleDuration(time,);
  }

  query_freework(query: ResourceScenarioQuery,): void {
    const work = this.getEffectiveFreeWork(
      query.startIdx ?? 0,
      query.endIdx ?? 0,
    );
    query.sortable = query.numerical = work;
    query.string = query.scaleLoad(work,);
  }

  query_headcount(query: ResourceScenarioQuery,): void {
    let headcount = 0;
    const property = this.getProperty();
    if ((property as PropertyTreeNode).container?.()) {
      for (const child of (property as PropertyTreeNode).kids()) {
        const q = query.dup();
        (child as Resource).scenarioData(this.getScenarioIdx(),)
          .query_headcount(
            q,
          );
        headcount += typeof q.numerical === "number" ? q.numerical : 0;
      }
    } else {
      if (this.employed(this.projExt().dateToIdx(query.start as TjTime,),)) {
        headcount += Math.round((this.a("efficiency",) as number) ?? 1,);
      }
    }
    query.sortable = query.numerical = headcount;
    query.string = query.numberFormat
      ? query.numberFormat.format(headcount,)
      : String(headcount,);
  }

  query_rate(query: ResourceScenarioQuery,): void {
    const r = this.rate();
    query.sortable = query.numerical = r;
    query.string = query.currencyFormat
      ? query.currencyFormat.format(r,)
      : String(r,);
  }

  query_revenue(query: ResourceScenarioQuery,): void {
    const account = query.revenueAccount
      ? (this.projExt().accounts.get(query.revenueAccount,) as Account | null)
      : null;
    if (account) {
      const revenue = this.turnover(
        query.startIdx ?? 0,
        query.endIdx ?? 0,
        account,
        query.scopeProperty as Task | null,
      );
      query.sortable = query.numerical = revenue;
      query.string = query.currencyFormat
        ? query.currencyFormat.format(revenue,)
        : String(revenue,);
    } else {
      query.string = "No 'balance' defined!";
    }
  }

  // ==================================================================
  // Onda B4 — query_* ancorados (dados de leave/fte ainda não produzidos).
  //
  // Não implementamos; deixamos o stub com âncora (política check:stubs).
  // Só são alcançados quando uma coluna/consulta os exige; caso contrário o
  // dispatch cai no atributo base, preservando a suíte verde.
  // ==================================================================

  // Ancorado: Fase 16 — férias (LeaveList annual) ainda não produzidas.
  query_annualleave(_query: ResourceScenarioQuery,): void {
    throw new NotYetImplementedError(
      "16",
      "ResourceScenario#query_annualleave",
    );
  }

  // Ancorado: Fase 16 — lista de LeaveList anual não portada.
  query_annualleavelist(_query: ResourceScenarioQuery,): void {
    throw new NotYetImplementedError(
      "16",
      "ResourceScenario#query_annualleavelist",
    );
  }

  // Ancorado: Fase 16 — saldo de LeaveList anual não portado.
  query_annualleavebalance(_query: ResourceScenarioQuery,): void {
    throw new NotYetImplementedError(
      "16",
      "ResourceScenario#query_annualleavebalance",
    );
  }

  // Ancorado: Fase 16 — sick leave (LeaveList) não portado.
  query_sickleave(_query: ResourceScenarioQuery,): void {
    throw new NotYetImplementedError("16", "ResourceScenario#query_sickleave",);
  }

  // Ancorado: Fase 16 — special leave (LeaveList) não portado.
  query_specialleave(_query: ResourceScenarioQuery,): void {
    throw new NotYetImplementedError(
      "16",
      "ResourceScenario#query_specialleave",
    );
  }

  // Ancorado: Fase 16 — dias de folga (time off) não portados.
  query_timeoffdays(_query: ResourceScenarioQuery,): void {
    throw new NotYetImplementedError(
      "16",
      "ResourceScenario#query_timeoffdays",
    );
  }

  // Ancorado: Fase 16 — unpaid leave (LeaveList) não portado.
  query_unpaidleave(_query: ResourceScenarioQuery,): void {
    throw new NotYetImplementedError(
      "16",
      "ResourceScenario#query_unpaidleave",
    );
  }

  // Ancorado: Fase 18 — FTE exige horas de contrato/calendário não portadas.
  query_fte(_query: ResourceScenarioQuery,): void {
    throw new NotYetImplementedError("18", "ResourceScenario#query_fte",);
  }
}
