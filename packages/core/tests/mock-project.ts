import { PropertySet, PropertyTreeNode } from "../src/model/property-tree-node.ts";
import { PropertyLike } from "../src/model/property-like.ts";
import { SourceFileInfo } from "../src/source-file-info.ts";
import { TjArgumentError } from "../src/attributes/errors.ts";
import { AttributeBase } from "../src/attributes/attribute-base.ts";
import { AttributeDefinition } from "../src/attributes/attribute-definition.ts";
import { AttributeType } from "../src/attributes/attribute-type.ts";
import { TjTime } from "../src/time/tj-time.ts";
import { Scoreboard } from "../src/time/scoreboard.ts";
import { Limits } from "../src/scheduling/limits.ts";
import { ShiftAssignments } from "../src/scheduling/shift-assignments.ts";
import { TaskDependency } from "../src/scheduling/task-dependency.ts";
import { Task } from "../src/model/task.ts";
import { Resource } from "../src/model/resource.ts";
import { Account } from "../src/model/account.ts";
import { Shift } from "../src/model/shift.ts";
import { Scenario } from "../src/model/scenario.ts";
import { PropertyList } from "../src/model/property-list.ts";
import { MessageHandlerInstance } from "../src/message-handler.ts";
import { Log } from "../src/log.ts";
import { AppConfig } from "../src/app-config.ts";
import { initTj3Config } from "../src/tj3-config.ts";
import { VERSION } from "../src/version.ts";
import { type ProjectLike, } from "../src/model/project-like.ts";
import { Report } from "../src/model/report.ts";
import { CostEvent } from "../src/model/cost-event.ts";
import { registerScenarioAttributes } from "../src/model/attributes/scenario-attributes.ts";
import { registerShiftAttributes } from "../src/model/attributes/shift-attributes.ts";
import { registerAccountAttributes } from "../src/model/attributes/account-attributes.ts";
import { registerResourceAttributes } from "../src/model/attributes/resource-attributes.ts";
import { registerTaskAttributes } from "../src/model/attributes/task-attributes.ts";
import { registerReportAttributes } from "../src/model/attributes/report-attributes.ts";

export class MockProject implements ProjectLike {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  private attributes: Map<string, unknown>;
  readonly scenarios: PropertySet;
  readonly shifts: PropertySet;
  readonly accounts: PropertySet;
  readonly resources: PropertySet;
  readonly tasks: PropertySet;
  readonly reports: PropertySet;
  readonly inputFiles: string[];
  readonly outputDir: string;
  readonly warnTsDeltas: boolean;
  scoreboard: Scoreboard<number | null> | null;
  scoreboardNoLeaves: Scoreboard<number | null> | null;
  resourceAvailability: Scoreboard<boolean> | null;
  costEvents: CostEvent[];
  trackingScenario: string | null;

  constructor(id: string, name: string = "MockProject", version: string = "0.0.0") {
    this.id = id;
    this.name = name;
    this.version = version;
    this.attributes = new Map();
    this.inputFiles = [];
    this.outputDir = "";
    this.warnTsDeltas = false;
    this.scoreboard = null;
    this.scoreboardNoLeaves = null;
    this.resourceAvailability = null;
    this.costEvents = [];
    this.trackingScenario = null;

    // Initialize AppConfig
    initTj3Config();

    // Create PropertySets
    this.scenarios = new PropertySet(this, true);
    this.shifts = new PropertySet(this, false);
    this.accounts = new PropertySet(this, false);
    this.resources = new PropertySet(this, false);
    this.tasks = new PropertySet(this, false);
    this.reports = new PropertySet(this, false);

    // Register attributes
    this.registerScenarioAttributes(this.scenarios);
    this.registerShiftAttributes(this.shifts);
    this.registerAccountAttributes(this.accounts);
    this.registerResourceAttributes(this.resources);
    this.registerTaskAttributes(this.tasks);
    this.registerReportAttributes(this.reports);

    // Create initial plan scenario
    const planScenario = new Scenario(this, "plan", "Plan", null);
    this.scenarios.addProperty(planScenario);
  }

  get scenarioCount(): number {
    return this.scenarios.items;
  }

  scenario(arg: number | string): Scenario | null {
    if (typeof arg === "number") {
      const scenario = this.scenarios.get(`scenario${arg}`);
      return scenario as Scenario | null;
    } else {
      const scenario = this.scenarios.get(arg);
      return scenario as Scenario | null;
    }
  }

  scenarioIdx(sc: Scenario | string): number | undefined {
    if (typeof sc === "string") {
      const scenario = this.scenarios.get(sc);
      return scenario ? this.scenarios.items - 1 : undefined;
    }
    return this.scenarios.items - 1;
  }

  shift(id: string): Shift | null {
    const prop = this.shifts.get(id);
    return prop as Shift | null;
  }

  account(id: string): Account | null {
    const prop = this.accounts.get(id);
    return prop as Account | null;
  }

  task(id: string): Task | null {
    const prop = this.tasks.get(id);
    return prop as Task | null;
  }

  resource(id: string): Resource | null {
    const prop = this.resources.get(id);
    return prop as Resource | null;
  }

  report(id: string): Report | null {
    const prop = this.reports.get(id);
    return prop as Report | null;
  }

  reportByName(name: string): Report | null {
    for (const prop of this.reports.toArray()) {
      if (prop.name === name) {
        return prop as Report;
      }
    }
    return null;
  }

  get(name: string): unknown {
    return this.attributes.get(name);
  }

  set(name: string, value: unknown): void {
    this.attributes.set(name, value);

    if (name === "start" || name === "end" || name === "scheduleGranularity" || name === "timezone") {
      this.reinitializeWorkingHours();
    }
  }

  dailyWorkingHours(): number {
    return 480; // minutes per day
  }

  weeklyWorkingDays(): number {
    return 5;
  }

  monthlyWorkingDays(): number {
    return this.weeklyWorkingDays() * 4.348;
  }

  yearlyWorkingDays(): number {
    return this.weeklyWorkingDays() * 52.1786;
  }

  slotsToDays(slots: number): number {
    const granularity = this.get("scheduleGranularity") as number;
    return slots / (3600 / granularity);
  }

  convertToDailyLoad(seconds: number): number {
    return seconds / (24 * 3600);
  }

  scoreboardSize(): number {
    return this.scoreboard?.size || 0;
  }

  idxToDate(sbIdx: number): TjTime {
    const date = this.scoreboard?.idxToDate(sbIdx) || new Date("2026-01-01");
    return TjTime.fromDate(date);
  }

  dateToIdx(date: TjTime, forceIntoProject: boolean = true): number {
    return this.scoreboard?.dateToIdx(date.toDate(), forceIntoProject) || 0;
  }

  isWorkingTime(sbIdx: number): boolean {
    const val = this.scoreboard?.get(sbIdx);
    if (val == null) return false;
    return (val & 0x02) === 0; // BIT_OFF_WORK = 2
  }

  hasWorkingTime(sbIdx: number): boolean {
    return this.isWorkingTime(sbIdx);
  }

  workingDays(interval: { start: number; end: number }): number {
    let workingDays = 0;
    for (let idx = interval.start; idx <= interval.end; idx++) {
      if (this.isWorkingTime(idx)) {
        workingDays++;
      }
    }
    return workingDays;
  }

  getWorkSlots(startIdx: number, endIdx: number): number {
    let workSlots = 0;
    for (let idx = startIdx; idx <= endIdx; idx++) {
      if (this.isWorkingTime(idx)) {
        workSlots++;
      }
    }
    return workSlots;
  }

  anyResourceAvailable(sbIdx: number): boolean {
    return this.resourceAvailability?.get(sbIdx) || false;
  }

  hasBookings(scenarioIdx: number): boolean {
    return false;
  }

  isProjectionMode(scenarioIdx: number): boolean {
    return false;
  }

  collectTimeOffIntervals(iv: { start: number; end: number }, minDuration: number): unknown {
    return null;
  }

  attributeName(id: string): string | undefined {
    const attrDef = this.scenarios.attributeDefinition(id);
    return attrDef?.name;
  }

  journal(query: unknown): unknown {
    throw new Error("NotYetImplementedError: journal depends on Phase 16");
  }

  to_s(): string {
    return `Project(id=${this.id}, name=${this.name}, version=${this.version})`;
  }

  addScenario(scenario: { id: string; fullId: string }): void {
    this.scenarios.addProperty(scenario as Scenario);
  }

  addShift(_s: unknown): void {}

  addAccount(_a: unknown): void {}

  addTask(_t: unknown): void {}

  addResource(_r: unknown): void {}

  addReport(_r: unknown): void {}

  removeAccount(_a: unknown): void {}

  static maxScheduleGranularity(): number {
    return 3600;
  }

  private registerScenarioAttributes(propertySet: PropertySet): void {
    registerScenarioAttributes(propertySet);
  }

  private registerShiftAttributes(propertySet: PropertySet): void {
    registerShiftAttributes(propertySet);
  }

  private registerAccountAttributes(propertySet: PropertySet): void {
    registerAccountAttributes(propertySet);
  }

  private registerResourceAttributes(propertySet: PropertySet): void {
    registerResourceAttributes(propertySet);
  }

  private registerTaskAttributes(propertySet: PropertySet): void {
    registerTaskAttributes(propertySet);
  }

  private registerReportAttributes(propertySet: PropertySet): void {
    registerReportAttributes(propertySet);
  }

  private reinitializeWorkingHours(): void {
    // Reinitialize working hours based on new start/end/timezone
    // This would typically involve recreating the working hours attribute
    // For now, we'll just log that this needs to be implemented
    console.log("Reinitializing working hours (not yet implemented)");
  }
}
