import { PropertySet } from "./property-set.ts";
import { PropertyTreeNode } from "./property-tree-node.ts";
import { PropertyLike } from "./property-like.ts";
import { SourceFileInfo } from "../source-file-info.ts";
import { TjArgumentError } from "../attributes/errors.ts";
import { AttributeBase } from "../attributes/attribute-base.ts";
import { AttributeDefinition } from "../attributes/attribute-definition.ts";
import { AttributeType } from "../attributes/attribute-type.ts";
import { TjTime } from "../time/tj-time.ts";
import { Scoreboard } from "../time/scoreboard-bits.ts";
import { Limits } from "../scheduling/limits.ts";
import { ShiftAssignments } from "../scheduling/shift-assignments.ts";
import { TimeSheets } from "../scheduling/time-sheets.ts";
import { ReportContext } from "../reports/report-context.ts";
import { Report } from "../reports/report.ts";
import { Task } from "./task.ts";
import { Resource } from "./resource.ts";
import { Account } from "./account.ts";
import { Shift } from "./shift.ts";
import { Scenario } from "./scenario.ts";
import { PropertyList } from "./property-list.ts";
import { MessageHandlerInstance } from "../message-handler.ts";
import { Log } from "../log.ts";
import { AppConfig } from "../app-config.ts";
import { initTj3Config } from "../tj3-config.ts";
import { VERSION } from "../version.ts";

export class Project implements ProjectLike {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  private attributes: Map<string, unknown>;
  readonly scenarios: PropertySet<Scenario>;
  readonly shifts: PropertySet<Shift>;
  readonly accounts: PropertySet<Account>;
  readonly resources: PropertySet<Resource>;
  readonly tasks: PropertySet<Task>;
  readonly reports: PropertySet<Report>;
  readonly inputFiles: string[];
  readonly timeSheets: TimeSheets;
  readonly reportContexts: ReportContext[];
  readonly outputDir: string;
  readonly warnTsDeltas: boolean;
  scoreboard: Scoreboard<number | null> | null;
  scoreboardNoLeaves: Scoreboard<number | null> | null;
  resourceAvailability: Scoreboard<boolean> | null;

  constructor(id: string, name: string, version: string) {
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
    const planScenario = new Scenario(this.scenarios, "plan", "Plan", null);
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
    return this.weeklyWorkingHours() / this.weeklyWorkingDays();
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

  idxToDate(idx: number): TjTime {
    return this.scoreboard?.idxToDate(idx) || TjTime.fromString("2026-01-01");
  }

  dateToIdx(date: TjTime, forceIntoProject: boolean = true): number {
    return this.scoreboard?.dateToIdx(date, forceIntoProject) || 0;
  }

  isWorkingTime(sbIdx: number): boolean {
    return this.scoreboard?.isWorkingTime(sbIdx) || true;
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

  anyResourceAvailable?(sbIdx: number): boolean {
    return this.resourceAvailability?.get(sbIdx) || false;
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

  private registerScenarioAttributes(propertySet: PropertySet<Scenario>): void {
    import("../model/attributes/scenario-attributes.ts").then(module => {
      module.registerScenarioAttributes(propertySet);
    });
  }

  private registerShiftAttributes(propertySet: PropertySet<Shift>): void {
    import("../model/attributes/shift-attributes.ts").then(module => {
      module.registerShiftAttributes(propertySet);
    });
  }

  private registerAccountAttributes(propertySet: PropertySet<Account>): void {
    import("../model/attributes/account-attributes.ts").then(module => {
      module.registerAccountAttributes(propertySet);
    });
  }

  private registerResourceAttributes(propertySet: PropertySet<Resource>): void {
    import("../model/attributes/resource-attributes.ts").then(module => {
      module.registerResourceAttributes(propertySet);
    });
  }

  private registerTaskAttributes(propertySet: PropertySet<Task>): void {
    import("../model/attributes/task-attributes.ts").then(module => {
      module.registerTaskAttributes(propertySet);
    });
  }

  private registerReportAttributes(propertySet: PropertySet<Report>): void {
    import("../model/attributes/report-attributes.ts").then(module => {
      module.registerReportAttributes(propertySet);
    });
  }

  private reinitializeWorkingHours(): void {
    // Reinitialize working hours based on new start/end/timezone
    // This would typically involve recreating the working hours attribute
    // For now, we'll just log that this needs to be implemented
    console.log("Reinitializing working hours (not yet implemented)");
  }
}
