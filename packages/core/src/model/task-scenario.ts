import { ScenarioData, } from "./scenario-data.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type PropertyLike, } from "./property-like.ts";
import { type TjTime, } from "../time/tj-time.ts";
import { Allocation, } from "../scheduling/allocation.ts";
import { ShiftAssignments, } from "../scheduling/shift-assignments.ts";
import { DurationType, } from "../scheduling/mod.ts";

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
  private _candidates: any[] = [];
  private _isRunAway: boolean = false;
  private _hasDurationSpec: boolean = false;
  private _currentSlotIdx: number | null = null;
  private _doneDuration: number = 0;
  private _doneLength: number = 0;
  private _doneEffort: number = 0.0;
  private _nowIdx: number = 0;
  private _startIsDetermed: boolean | null = null;
  private _endIsDetermed: boolean | null = null;
  private _startPropagated: boolean = false;
  private _endPropagated: boolean = false;
  private _allLimits: any[] = [];
  private _contendedResources: Map<any, Map<any, number>> = new Map();
  private _mandatories: any[] = [];
  private _startpreds: any[] = [];
  private _startsuccs: any[] = [];
  private _endpreds: any[] = [];
  private _endsuccs: any[] = [];
  private _deadEndFlags: boolean[] = [false, false, false, false];
  private _criticalness: number = 0.0;
  private _pathcriticalness: number | null = null;
  private _complete: number | null = null;
  private _status: string = "";
  private _gauge: string | null = null;
  private _errors: number = 0;

  constructor(task: any, scIdx: number, attributes: Map<string, any>) {
    super(task, scIdx, attributes);
    this.preloadAttributes(TASK_SCENARIO_ATTRS);
  }

  markAsScheduled(): void {
    if ((this as any)._scheduled) return;
    (this as any)._scheduled = true;
  }

  prepareScheduling(): void {
    const scIdx = this.getScenarioIdx();
    (this.getProperty() as any).setForScenario("startpreds", [], scIdx);
    (this.getProperty() as any).setForScenario("startsuccs", [], scIdx);
    (this.getProperty() as any).setForScenario("endpreds", [], scIdx);
    (this.getProperty() as any).setForScenario("endsuccs", [], scIdx);

    this._isRunAway = false;
    this._currentSlotIdx = null;
    this._doneDuration = 0;
    this._doneLength = 0;
    this._doneEffort = 0.0;

    const project = (this.getProperty() as any).project as ProjectLike;
    this._nowIdx = project.dateToIdx(project.get("now") as TjTime);

    this._startIsDetermed = null;
    this._endIsDetermed = null;
    this._startPropagated = false;
    this._endPropagated = false;

    const effort = this.a("effort") as number;
    const length = this.a("length") as number;
    const duration = this.a("duration") as number;
    const milestone = this.a("milestone") as boolean;

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
    (this as any)._durationType = durationType;

    this.markAsMilestone();

    this._allLimits = [];
    let task: any = this.getProperty();
    while (task) {
      const limits = task.getForScenario("limits", scIdx);
      if (limits) this._allLimits.push(limits);
      task = task.parent;
    }

    this._contendedResources = new Map();

    this._mandatories = [];
    const allocate = this.a("allocate") as any[];
    if (allocate) {
      for (const allocation of allocate) {
        if (allocation.mandatory) this._mandatories.push(allocation);
        allocation.lockedResource = null;
      }
    }

    this.bookBookings();

    if (durationType === "startEndTask") {
      const start = this.a("start") as TjTime;
      const end = this.a("end") as TjTime;
      if (start) {
        (this.getProperty() as any).setForScenario("startIdx", project.dateToIdx(start), scIdx);
      }
      if (end) {
        (this.getProperty() as any).setForScenario("endIdx", project.dateToIdx(end), scIdx);
      }
    }
  }

  Xref(): void {
    const scIdx = this.getScenarioIdx();
    const depends = this.a("depends") as any[];
    if (depends) {
      for (const dependency of depends) {
        const depTask = this.checkDependency(dependency, "depends");
        this._startpreds.push([depTask, dependency.onEnd]);
        (depTask.scenarioData(scIdx) as any)._startsuccs.push([this.getProperty(), false]);
      }
    }
    const precedes = this.a("precedes") as any[];
    if (precedes) {
      for (const dependency of precedes) {
        const predTask = this.checkDependency(dependency, "precedes");
        this._endsuccs.push([predTask, dependency.onEnd]);
        (predTask.scenarioData(scIdx) as any)._endpreds.push([this.getProperty(), true]);
      }
    }
  }

  hasDependency(depType: string, target: any, onEnd: boolean): boolean {
    const list = this.a(depType) as any[];
    return list ? list.some(([t, oe]: any[]) => t === target && oe === onEnd) : false;
  }

  /**
   * Verifica e resolve uma dependência cruzada.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:checkDependency
   */
  checkDependency(dependency: any, depType: string): any {
    const task = this.project().task(dependency.taskId);
    if (!task) {
      this.error("unknown_task", `Unknown task '${dependency.taskId}'`);
      return null;
    }
    return task;
  }

  /**
   * Propaga uma data (start ou end) para a tarefa.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:propagateDate
   */
  propagateDate(date: TjTime, end: boolean, set: boolean): void {
    const idx = (this.getProperty() as any).project.dateToIdx(date);
    if (end) {
      (this.getProperty() as any).setForScenario("endIdx", idx, this.getScenarioIdx());
    } else {
      (this.getProperty() as any).setForScenario("startIdx", idx, this.getScenarioIdx());
    }
  }

  /**
   * Verifica se a tarefa pode herdar uma data do cenário.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:canInheritDate
   */
  canInheritDate(end: boolean): boolean {
    return true;
  }

  propagateInitialValues(): void {
    const project = (this.getProperty() as any).project as ProjectLike;
    if (!this._startPropagated) {
      const start = this.a("start") as TjTime;
      if (start) {
        this.propagateDate(start, false, true);
      } else if (this.getProperty().parent === null &&
        this.canInheritDate(false)) {
        this.propagateDate(project.get("start") as TjTime, false, true);
      }
    }
    if (!this._endPropagated) {
      const end = this.a("end") as TjTime;
      if (end) {
        this.propagateDate(end, true, true);
      } else if (this.getProperty().parent === null &&
        this.canInheritDate(true)) {
        this.propagateDate(project.get("end") as TjTime, true, true);
      }
    }
  }

  markAsMilestone(): void {
    const milestone = this.a("milestone") as boolean;
    if (milestone && (this.getProperty() as any).container?.()) {
      this.error("container_milestone",
        `Container task ${(this.getProperty() as any).fullId} may not be marked as a milestone.`);
      return;
    }

    if ((this.getProperty() as any).container?.() || this._hasDurationSpec ||
      !(this.a("booking") as any[])?.length || !(this.a("allocate") as any[])?.length) {
      return;
    }

    const hasStartSpec = !!(this.a("start") as TjTime) || !!(this.a("depends") as any[])?.length;
    const hasEndSpec = !!(this.a("end") as TjTime) || !!(this.a("precedes") as any[])?.length;

    const newMilestone = (hasStartSpec && this.a("forward") as boolean && !hasEndSpec) ||
      (!hasStartSpec && !(this.a("forward") as boolean) && hasEndSpec) ||
      (!hasStartSpec && !hasEndSpec);

    if (newMilestone) {
      this._hasDurationSpec = true;
      const start = this.a("start") as TjTime;
      const end = this.a("end") as TjTime;
      if (start && !end) {
        (this.getProperty() as any).setForScenario("end", start, this.getScenarioIdx());
      } else if (!start && end) {
        (this.getProperty() as any).setForScenario("start", end, this.getScenarioIdx());
      }
    }
  }

  /**
   * Reserva as vagas definidas nas bookins da tarefa.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:bookBookings
   */
  bookBookings(): void {
    const bookings = this.a("booking") as any[];
    if (!bookings) return;
    for (const booking of bookings) {
      booking.book(this);
    }
  }

  /**
   * Reseta as flags deadEndFlags para [false, false, false, false].
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:resetLoopFlags
   */
  resetLoopFlags(): void {
    this._deadEndFlags = [false, false, false, false];
  }

  /**
   * Verifica se a tarefa tem dependências em determinado end.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:hasDependencies
   */
  hasDependencies(atEnd: boolean): boolean {
    const list = atEnd ? this._endsuccs : this._startpreds;
    return list.length > 0;
  }

  /**
   * Verifica se a tarefa tem dependências fortes em determinado end.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:hasStrongDeps?
   */
  hasStrongDeps(atEnd: boolean): boolean {
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
    const granularity = (project.get("scheduleGranularity") as number) ?? 3600;
    const dailyWorkingHours = (project.get("dailyWorkingHours") as number) ?? 8;
    const remainingEffort = (granularity * (this.a("effort") as number - this._doneEffort)) / (dailyWorkingHours * 3600);
    this.warning("runaway", `${remainingEffort}d of effort of task ${(this.getProperty() as any).fullId} does not fit into the project time frame.`);
    const competitors = this.a("competitors") as any[];
    if (competitors && competitors.length > 0) {
      this.warning("runaway_competitor", `Task ${(this.getProperty() as any).fullId} has competitors for the same resources.`);
    }
  }

  /**
   * Verifica se a tarefa está pronta para ser agendada.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:readyForScheduling?
   */
  readyForScheduling(): boolean {
    if ((this as any)._scheduled) return true;
    if (this._isRunAway) return false;
    const forward = this.a("forward") as boolean;
    const start = this.a("start") as TjTime;
    const end = this.a("end") as TjTime;
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
    const chargeset = this.a("chargeset") as any[];
    if (chargeset) {
      for (const chargesetItem of chargeset) {
        for (const [account, share] of chargesetItem) {
          if (account && !account.leaf?.()) {
            this.error("account_no_leaf", `Chargesets may not include group account ${account.fullId}.`);
          }
        }
      }
    }

    const responsible = this.a("responsible") as any[];
    if (responsible) {
      const convertedResponsible = [];
      for (const resourceId of responsible) {
        const resource = this.project().task(resourceId);
        if (!resource) {
          this.error("resource_id_expected", `${resourceId} is not a defined resource.`);
        } else {
          convertedResponsible.push(resource);
        }
      }
      (this.getProperty() as any).setForScenario("responsible", convertedResponsible, this.getScenarioIdx());
    }

    const booking = this.a("booking") as any[];
    if (booking.length > 0 && (this.getProperty() as any).container?.()) {
      this.error("container_booking", `Container task ${(this.getProperty() as any).fullId} may not have bookings.`);
    }

    const milestone = this.a("milestone") as boolean;
    if (milestone && booking.length > 0) {
      this.error("milestone_booking", `Milestone ${(this.getProperty() as any).fullId} may not have bookings.`);
    }

    if ((this as any)._scheduled && (!this.a("start") || !this.a("end"))) {
      this.error("not_scheduled", `Task ${(this.getProperty() as any).fullId} is marked as scheduled but does not have a fixed start and end date.`);
    }

    const effort = this.a("effort") as number;
    const allocate = this.a("allocate") as any[];
    if (effort > 0 && (!allocate || allocate.length === 0)) {
      this.error("effort_no_allocations", `Task ${(this.getProperty() as any).fullId} has an effort but no resource allocations.`);
    }

    let durationSpecs = 0;
    if (effort > 0) durationSpecs++;
    if ((this.a("length") as number) > 0) durationSpecs++;
    if ((this.a("duration") as number) > 0) durationSpecs++;
    if (milestone) durationSpecs++;

    if ((this.getProperty() as any).container?.() && durationSpecs > 0) {
      this.error("container_duration", `Container task ${(this.getProperty() as any).fullId} may not have a duration or be marked as milestones.`);
    }

    if (milestone && durationSpecs > 1) {
      this.error("milestone_duration", `Milestone ${(this.getProperty() as any).fullId} may not have a duration.`);
    }

    if (milestone && this.a("start") && this.a("end") && (this.a("start") as any).toSeconds() !== (this.a("end") as any).toSeconds()) {
      this.error("milestone_start_end", `Start (${(this.a("start") as any).toString()}) and end (${(this.a("end") as any).toString()}) dates of milestone task ${(this.getProperty() as any).fullId} must be identical.`);
    }

    const forward = this.a("forward") as boolean;
    const hasDependenciesStart = this.hasDependencies(false);
    const hasDependenciesEnd = this.hasDependencies(true);

    if (!milestone && !((this.getProperty() as any).container?.())) {
      if (durationSpecs === 0 && ((forward && !this.a("end") && !hasDependenciesEnd) || (!forward && !this.a("start") && !hasDependenciesStart))) {
        this.error("task_underspecified", `Task ${(this.getProperty() as any).fullId} has too few specifications to be scheduled.`);
      }

      if (durationSpecs > 1) {
        this.error("multiple_durations", `Tasks may only have either a duration, length or effort or be a milestone.`);
      }

      const startSpeced = (this.getProperty() as any).provided("start", this.getScenarioIdx());
      const endSpeced = (this.getProperty() as any).provided("end", this.getScenarioIdx());
      if (((startSpeced && endSpeced) || (hasDependenciesStart && forward && endSpeced) || (hasDependenciesEnd && !forward && startSpeced)) && durationSpecs > 0 && !(this.getProperty() as any).provided("scheduled", this.getScenarioIdx())) {
        this.error("task_overspecified", `Task ${(this.getProperty() as any).fullId} has a start, an end and a duration specification.`);
      }
    }

    if (!forward && booking && booking.length > 0 && !(this as any)._scheduled) {
      this.error("alap_booking", 'A task scheduled in ALAP mode may only have bookings if it has been marked as fully scheduled.');
    }

    for (const [task, onEnd] of this._startsuccs) {
      if (!task.a("forward")) {
        task.error("onstart_wrong_direction", 'Tasks with on-start dependencies must be ASAP scheduled');
      }
    }

    for (const [task, onEnd] of this._endpreds) {
      if (task.a("forward")) {
        task.error("onend_wrong_direction", 'Tasks with on-end dependencies must be ALAP scheduled');
      }
    }
  }

  /**
   * Verifica se há loops de dependência.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:checkForLoops
   */
  checkForLoops(path: any[], atEnd: boolean, fromOutside: boolean, forward: boolean): void {
    if (path.includes([(this.getProperty() as any), atEnd])) {
      this.warning("loop_detected", `Dependency loop detected at ${atEnd ? 'end' : 'start'} of task ${(this.getProperty() as any).fullId}`);
      let skip = true;
      for (const [t, e] of path) {
        if (t === (this.getProperty() as any) && e === atEnd) {
          skip = false;
          continue;
        }
        if (!skip) {
          this.info(`loop_at_${e ? 'end' : 'start'}`, `Loop contained at ${e ? 'end' : 'start'} of task ${t.fullId}`);
        }
      }
      this.error("loop_end", "Aborting");
      return;
    }

    if (this._deadEndFlags[(atEnd ? 2 : 0) + (fromOutside ? 1 : 0)]) {
      return;
    }

    path.push([(this.getProperty() as any), atEnd]);

    if (!atEnd) {
      if (fromOutside) {
        if ((this.getProperty() as any).container?.()) {
          for (const child of (this.getProperty() as any).children) {
            child.scenarioData(this.getScenarioIdx()).checkForLoops(path, false, true, forward);
          }
        } else {
          if ((forward && this.a("forward")) || this.a("milestone")) {
            this.checkForLoops(path, true, false, true);
          }
        }
      } else {
        if (this._startpreds.length === 0 && (this.getProperty() as any).parent) {
          (this.getProperty() as any).parent.scenarioData(this.getScenarioIdx()).checkForLoops(path, false, false, forward);
        } else {
          for (const [task, targetEnd] of this._startpreds) {
            task.scenarioData(this.getScenarioIdx()).checkForLoops(path, targetEnd, true, forward);
          }
        }
      }
    } else {
      if (fromOutside) {
        if ((this.getProperty() as any).container?.()) {
          for (const child of (this.getProperty() as any).children) {
            child.scenarioData(this.getScenarioIdx()).checkForLoops(path, true, true, forward);
          }
        } else {
          if ((!forward && !this.a("forward")) || this.a("milestone")) {
            this.checkForLoops(path, false, false, false);
          }
        }
      } else {
        if (this._endsuccs.length === 0 && (this.getProperty() as any).parent) {
          (this.getProperty() as any).parent.scenarioData(this.getScenarioIdx()).checkForLoops(path, true, false, forward);
        } else {
          for (const [task, targetEnd] of this._endsuccs) {
            task.scenarioData(this.getScenarioIdx()).checkForLoops(path, targetEnd, true, forward);
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

    if (this.a("milestone")) {
      this._criticalness = (this.a("priority") as number) / 500.0;
      return;
    }

    if ((this.a("effort") as number) <= 0 || !this._candidates || this._candidates.length === 0) {
      return;
    }

    let criticalness = 0.0;
    for (const resource of this._candidates) {
      criticalness += resource.get("criticalness", this.getScenarioIdx()) as number;
    }
    criticalness /= this._candidates.length;

    this._criticalness = (this.a("effort") as number) * criticalness;
  }

  /**
   * Calcula a path criticalness.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:calcPathCriticalness
   */
  calcPathCriticalness(atEnd: boolean = false): number {
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
      if ((this.getProperty() as any).container?.()) {
        for (const task of (this.getProperty() as any).children) {
          const criticalness = task.scenarioData(this.getScenarioIdx()).calcPathCriticalness(false);
          if (criticalness > maxCriticalness) {
            maxCriticalness = criticalness;
          }
        }
      } else {
        for (const [task, onEnd] of this._startsuccs) {
          const criticalness = task.scenarioData(this.getScenarioIdx()).calcPathCriticalness(onEnd);
          if (criticalness > maxCriticalness) {
            maxCriticalness = criticalness;
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

    if ((this.getProperty() as any).container?.()) {
      for (const task of (this.getProperty() as any).children) {
        const criticalness = task.scenarioData(this.getScenarioIdx()).calcPathCriticalnessEndSuccs();
        if (criticalness > maxCriticalness) {
          maxCriticalness = criticalness;
        }
      }
    } else {
      for (const [task, onEnd] of this._endsuccs) {
        const criticalness = task.scenarioData(this.getScenarioIdx()).calcPathCriticalnessEndSuccs();
        if (criticalness > maxCriticalness) {
          maxCriticalness = criticalness;
        }
      }
    }

    return maxCriticalness;
  }

  /**
   * Conta as alocações de recursos e adiciona o esforço médio a cada recurso.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:countResourceAllocations
   */
  countResourceAllocations(): void {
    if (!this._candidates || this._candidates.length === 0 || (this.a("effort") as number) <= 0) {
      return;
    }

    const avgEffort = (this.a("effort") as number) / this._candidates.length;
    for (const resource of this._candidates) {
      const current = resource.get("alloctdeffort", this.getScenarioIdx()) as number;
      resource.set("alloctdeffort", current + avgEffort, this.getScenarioIdx());
    }
  }

  /**
   * Retorna a lista de recursos candidatos (folha) alocados a esta tarefa.
   *
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:candidates
   */
  candidates(): any[] {
    if (this._candidates.length > 0) {
      return this._candidates;
    }

    const allocate = this.a("allocate") as any[];
    if (!allocate) {
      return [];
    }

    const candidates: any[] = [];
    for (const allocation of allocate) {
      for (const candidate of allocation.candidatesList(this.getScenarioIdx())) {
        if (!candidates.includes(candidate)) {
          candidates.push(candidate);
        }
      }
    }

    this._candidates = candidates;
    return candidates;
  }

  durationType(): string {
    return (this as any)._durationType;
  }

  hasDurationSpec(): boolean {
    return this._hasDurationSpec;
  }

  project(): ProjectLike {
    return (this.getProperty() as any).project as ProjectLike;
  }

  override getProperty(): any {
    return (this as any).property;
  }

  override getScenarioIdx(): number {
    return (this as any).scenarioIdx;
  }

  override a(attr: string): unknown {
    return super.a(attr);
  }

  milestone(): boolean {
    return this.a("milestone") as boolean;
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

  isDependencyOf(task: any): boolean {
    const scIdx = this.getScenarioIdx();
    const depends = task.a("depends") as any[];
    if (depends) {
      for (const dep of depends) {
        if (dep.task === this.getProperty()) return true;
      }
    }
    const precedes = task.a("precedes") as any[];
    if (precedes) {
      for (const dep of precedes) {
        if (dep.task === this.getProperty()) return true;
      }
    }
    return false;
  }

  shiftAssignments(scIdx: number): ShiftAssignments | null {
    const shifts = this.a("shifts") as any[];
    if (!shifts || shifts.length === 0) return null;
    return new ShiftAssignments();
  }

  shifts(): boolean {
    const shifts = this.a("shifts") as any[];
    return !!(shifts && shifts.length > 0);
  }

  startpreds(): any[] {
    return this._startpreds;
  }

  startsuccs(): any[] {
    return this._startsuccs;
  }

  endpreds(): any[] {
    return this._endpreds;
  }

  endsuccs(): any[] {
    return this._endsuccs;
  }

  forward(): boolean {
    return this.a("forward") as boolean;
  }

  startIdx(): number | null {
    return (this.getProperty() as any).getForScenario("startIdx", this.getScenarioIdx()) as number ?? null;
  }

  endIdx(): number | null {
    return (this.getProperty() as any).getForScenario("endIdx", this.getScenarioIdx()) as number ?? null;
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
    return this._doneEffort;
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

  allLimits(): any[] {
    return this._allLimits;
  }

  contendedResources(): Map<any, Map<any, number>> {
    return this._contendedResources;
  }

  mandatories(): any[] {
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

  override error(id: string, text: string, sfi?: string, property?: PropertyLike): void {
    super.error(id, text, sfi, property);
    this._errors++;
  }

  errors(): number {
    return this._errors;
  }
}
