import { ScenarioData, } from "./scenario-data.ts";
import { type ProjectLike, } from "./project-like.ts";
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

  candidates(): any[] {
    return this._candidates;
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
}
