import { ScenarioData, } from "./scenario-data.ts";
import { type Task, } from "./task.ts";
import { type Resource, } from "./resource.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type PropertyLike, } from "./property-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
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
  "status",
];

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
  private _startpreds: [Task | null, boolean,][] = [];
  private _startsuccs: [Task | null, boolean,][] = [];
  private _endpreds: [Task | null, boolean,][] = [];
  private _endsuccs: [Task | null, boolean,][] = [];
  private _deadEndFlags: boolean[] = [false, false, false, false,];
  private _criticalness: number = 0.0;
  private _pathcriticalness: number | null = null;
  private _complete: number | null = null;
  private _status: string = "";
  private _gauge: string | null = null;
  private _errors: number = 0;
  private _scheduled: boolean = false;
  private _durationType: string = "";
  private _shifts: ShiftAssignments | null = null;

  constructor(
    task: Task,
    scIdx: number,
    attributes: Map<string, AttributeBase<unknown>>,
  ) {
    super(task, scIdx, attributes,);
    this.preloadAttributes(TASK_SCENARIO_ATTRS,);
  }

  markAsScheduled(): void {
    if (this._scheduled) return;
    this._scheduled = true;
  }

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

    this.markAsMilestone();

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

  Xref(): void {
    const scIdx = this.getScenarioIdx();
    const depends = this.a("depends",) as TaskDependency[];
    if (depends) {
      for (const dependency of depends) {
        const depTask = this.checkDependency(dependency, "depends",);
        if (depTask) {
          this._startpreds.push([depTask, dependency.onEnd,],);
          (depTask.scenarioData(scIdx,) as TaskScenario)._startsuccs.push([
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
          (predTask.scenarioData(scIdx,) as TaskScenario)._endpreds.push([
            this.getProperty(),
            true,
          ],);
        }
      }
    }
  }

  hasDependency(
    depType: string,
    target: Task | null,
    onEnd: boolean,
  ): boolean {
    const list = this.a(depType,) as TaskDependency[];
    return list
      ? list.some((dependency,) =>
        dependency.task === target && dependency.onEnd === onEnd
      )
      : false;
  }

  /**
   * Verifica e resolve uma dependência cruzada.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:checkDependency
   */
  checkDependency(dependency: TaskDependency, depType: string,): Task | null {
    const task = this.project().task(dependency.taskId,);
    if (!task) {
      this.error("unknown_task", `Unknown task '${dependency.taskId}'`,);
      return null;
    }
    return task;
  }

  /**
   * Propaga uma data (start ou end) para a tarefa.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:propagateDate
   */
  propagateDate(date: TjTime, end: boolean, set: boolean,): void {
    const idx = (this.getProperty() as Task).project.dateToIdx(date,);
    if (end) {
      this._endIdx = idx;
    } else {
      this._startIdx = idx;
    }
  }

  startIdx(): number | null {
    return this._startIdx;
  }

  endIdx(): number | null {
    return this._endIdx;
  }

  /**
   * Verifica se a tarefa pode herdar uma data do cenário.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:canInheritDate
   */
  canInheritDate(end: boolean,): boolean {
    return true;
  }

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

  markAsMilestone(): void {
    const milestone = this.a("milestone",) as boolean;
    if (milestone && (this.getProperty() as Task).container?.()) {
      this.error(
        "container_milestone",
        `Container task ${
          (this.getProperty() as Task).fullId
        } may not be marked as a milestone.`,
      );
      return;
    }

    if (
      (this.getProperty() as Task).container?.() || this._hasDurationSpec ||
      !(this.a("booking",) as unknown[])?.length ||
      !(this.a("allocate",) as Allocation[])?.length
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
      const start = this.a("start",) as TjTime;
      const end = this.a("end",) as TjTime;
      if (start && !end) {
        (this.getProperty() as Task).setForScenario(
          "end",
          start,
          this.getScenarioIdx(),
        );
      } else if (!start && end) {
        (this.getProperty() as Task).setForScenario(
          "start",
          end,
          this.getScenarioIdx(),
        );
      }
    }
  }

  /**
   * Reserva as vagas definidas nas bookins da tarefa.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:bookBookings
   */
  bookBookings(): void {
    const bookings = this.a("booking",) as Booking[];
    if (!bookings) return;
    const scIdx = this.getScenarioIdx();
    for (const booking of bookings) {
      for (const interval of booking.intervals) {
        const startIdx = this.project().dateToIdx(
          this.project().idxToDate(interval.start,),
        );
        const endIdx = this.project().dateToIdx(
          this.project().idxToDate(interval.end,),
        );
        for (let idx = startIdx; idx < endIdx; idx++) {
          booking.resource.scenarioData(scIdx,).bookBooking(idx, booking,);
        }
      }
    }
  }

  /**
   * Reseta as flags deadEndFlags para [false, false, false, false].
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:resetLoopFlags
   */
  resetLoopFlags(): void {
    this._deadEndFlags = [false, false, false, false,];
  }

  /**
   * Verifica se a tarefa tem dependências em determinado end.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:hasDependencies
   */
  hasDependencies(atEnd: boolean,): boolean {
    const list = atEnd ? this._endsuccs : this._startpreds;
    return list.length > 0;
  }

  /**
   * Verifica se a tarefa tem dependências fortes em determinado end.
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
   * Marca a tarefa como runaway (fora do intervalo do projeto).
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
   * Verifica se a tarefa está pronta para ser agendada.
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
   * Realiza verificações de consistência antes do agendamento.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:preScheduleCheck
   */
  preScheduleCheck(): void {
    const chargeset = this.a("chargeset",) as Map<Account, number>[];
    if (chargeset) {
      for (const chargesetItem of chargeset) {
        for (const [account, share,] of chargesetItem) {
          if (account && !account.leaf?.()) {
            this.error(
              "account_no_leaf",
              `Chargesets may not include group account ${account.fullId}.`,
            );
          }
        }
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
   * Verifica se há loops de dependência.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:checkForLoops
   */
  checkForLoops(
    path: [Task, boolean,][],
    atEnd: boolean,
    fromOutside: boolean,
    forward: boolean,
  ): void {
    if (path.includes([this.getProperty() as Task, atEnd,],)) {
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
            `Loop contained at ${e ? "end" : "start"} of task ${t.fullId}`,
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
   * Calcula a criticalness da tarefa.
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
   * Calcula a path criticalness.
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
   * Calcula a path criticalness para os sucessores do end.
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
      for (const child of (this.getProperty() as Task).children) {
        amount += (child as Task).scenarioData(this.getScenarioIdx(),).turnover(
          startIdx,
          endIdx,
          account,
          resource,
        );
      }
    } else {
      // If we are evaluating the task in the context of a specific resource,
      // we use the chargeset of that resource, not the chargeset of the task.
      const chargeset = resource
        ? (resource.scenarioData(this.getScenarioIdx(),) as ResourceScenario).a(
          "chargeset",
        )
        : this.a("chargeset",);

      // If there are no chargeset defined for this task, we don't need to
      // compute the resource related or other cost.
      if (chargeset) {
        let resourceCost = 0.0;
        const otherCost = 0.0;

        // Container tasks don't have resource cost.
        if (!(this.getProperty() as Task).container?.()) {
          if (resource) {
            resourceCost = (resource.scenarioData(
              this.getScenarioIdx(),
            ) as ResourceScenario).cost(
              startIdx,
              endIdx,
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

        const charge = this.a("charge",) as unknown[];
        if (charge && charge.length > 0) {
          // Add one-time and periodic charges to the amount.
          for (const chargeItem of charge) {
            // TODO(#7): Implement charge.turnover
            // For now, skip
          }
        }

        const totalCost = resourceCost + otherCost;
        // Now weight the total cost by the share of the account
        for (const chargesetItem of chargeset as Map<Account, number>[]) {
          for (const [accnt, share,] of chargesetItem) {
            if (
              share > 0.0 && (accnt === account || accnt.isChildOf?.(account,))
            ) {
              amount += totalCost * share;
            }
          }
        }
      }
    }

    return amount;
  }

  /**
   * Conta as alocações de recursos e adiciona o esforço médio a cada recurso.
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
   * Retorna a lista de recursos candidatos (folha) alocados a esta tarefa.
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

  durationType(): string {
    return this._durationType;
  }

  onShift(sbIdx: number,): boolean {
    const shifts = this._shifts;
    if (shifts && shifts.assigned?.(sbIdx,)) {
      return shifts.onShift?.(sbIdx,);
    } else {
      return this.project().isWorkingTime(sbIdx,);
    }
  }

  hasDurationSpec(): boolean {
    return this._hasDurationSpec;
  }

  project(): ProjectLike {
    return (this.getProperty() as Task).project as ProjectLike;
  }

  override getProperty(): Task {
    return super.getProperty() as Task;
  }

  override getScenarioIdx(): number {
    return this.scenarioIdx;
  }

  override a(attr: string,): unknown {
    return super.a(attr,);
  }

  milestone(): boolean {
    return this.a("milestone",) as boolean;
  }

  getEffectiveWork(): number {
    return this._doneEffort;
  }

  isRunAway(): boolean {
    return this._isRunAway;
  }

  runAway(): void {
    this._isRunAway = true;
  }

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

  shiftAssignments(scIdx: number,): ShiftAssignments | null {
    const shifts = this.a("shifts",) as ShiftAssignments[];
    if (!shifts || shifts.length === 0) return null;
    return new ShiftAssignments();
  }

  shifts(): boolean {
    const shifts = this.a("shifts",) as ShiftAssignments[];
    return !!(shifts && shifts.length > 0);
  }

  startpreds(): [Task | null, boolean,][] {
    return this._startpreds;
  }

  startsuccs(): [Task | null, boolean,][] {
    return this._startsuccs;
  }

  endpreds(): [Task | null, boolean,][] {
    return this._endpreds;
  }

  endsuccs(): [Task | null, boolean,][] {
    return this._endsuccs;
  }

  forward(): boolean {
    return this.a("forward",) as boolean;
  }

  currentSlotIdx(): number | null {
    return this._currentSlotIdx;
  }

  doneDuration(): number {
    return this._doneDuration;
  }

  doneLength(): number {
    return this._doneLength;
  }

  doneEffort(): number {
    return this.a("effortdone",) as number ?? 0;
  }

  nowIdx(): number {
    return this._nowIdx;
  }

  startIsDetermed(): boolean | null {
    return this._startIsDetermed;
  }

  endIsDetermed(): boolean | null {
    return this._endIsDetermed;
  }

  startPropagated(): boolean {
    return this._startPropagated;
  }

  endPropagated(): boolean {
    return this._endPropagated;
  }

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

  contendedResources(): Map<Task, Map<Resource, number>> {
    return this._contendedResources;
  }

  mandatories(): Allocation[] {
    return this._mandatories;
  }

  deadEndFlags(): boolean[] {
    return this._deadEndFlags;
  }

  criticalness(): number {
    return this._criticalness;
  }

  pathcriticalness(): number | null {
    return this._pathcriticalness;
  }

  complete(): number | null {
    return this._complete;
  }

  status(): string {
    return this._status;
  }

  gauge(): string | null {
    return this._gauge;
  }

  override error(
    id: string,
    text: string,
    sfi?: string,
    property?: PropertyLike,
  ): void {
    super.error(id, text, sfi, property,);
    this._errors++;
  }

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

    this.prepareScheduling();

    const logTag = `schedule_${(this.getProperty() as Task).id}`;
    console.log(
      `[${logTag}] Scheduling task ${(this.getProperty() as Task).id}`,
    );

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
        console.log(
          `[${logTag}] Scheduling of task ${
            (this.getProperty() as Task).id
          } failed: currentSlotIdx is null`,
        );
        return false;
      }
      this._currentSlotIdx += delta;
      if (
        this._currentSlotIdx < lowerLimit ||
        upperLimit < this._currentSlotIdx
      ) {
        this.markAsRunaway();
        console.log(
          `[${logTag}] Scheduling of task ${
            (this.getProperty() as Task).id
          } failed`,
        );
        return false;
      }
    }

    console.log(
      `[${logTag}] Scheduling of task ${
        (this.getProperty() as Task).id
      } completed`,
    );
    return true;
  }

  /**
   * Schedule a single slot. Returns false if the task has been completely scheduled.
   */
  scheduleSlot(): boolean {
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
            console.log(
              `Task ${(this.getProperty() as Task).fullId} first assignment`,
            );
          } else {
            this.propagateDate(
              this.project().idxToDate((this.currentSlotIdx() as number) + 1,),
              true,
              true,
            );
            console.log(
              `Task ${(this.getProperty() as Task).fullId} last assignment`,
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
      task.setForScenario("start", nStart, this.getScenarioIdx(),);
      startSet = true;
    }
    if (taskSc.a("end",) === null || (taskSc.a("end",) as TjTime) < nEnd) {
      task.setForScenario("end", nEnd, this.getScenarioIdx(),);
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
   * Finish scheduling: compute completion and status.
   */
  finishScheduling(): void {
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
   * Compute completion percentage.
   */
  calcCompletion(): void {
    const effort = this.a("effort",) as number;
    if (effort > 0) {
      this._complete = Math.round((this.doneEffort() / effort) * 100,);
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
   * Propagate date changes to dependent tasks.
   */
  propagateDateToDep(): void {
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

      const changed = dependency.onEnd
        ? dependentScenarioData.a("start",) !== null &&
          (dependentScenarioData.a("start",) as TjTime).toSeconds() <
            (this.a("end",) as TjTime).toSeconds()
        : dependentScenarioData.a("end",) !== null &&
          (dependentScenarioData.a("end",) as TjTime).toSeconds() >
            (this.a("start",) as TjTime).toSeconds();

      if (changed) {
        dependent.scenarioData(this.getScenarioIdx(),).finishScheduling();
      }
    }
  }
}
