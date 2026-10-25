import { PropertySet, } from "./property-set.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { PropertyLike, } from "./property-like.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type CostEvent, } from "./cost-event.ts";
import { SourceFileInfo, } from "../source-file-info.ts";
import { TjArgumentError, } from "../attributes/errors.ts";
import { NotYetImplementedError, TjInternalError, } from "./errors.ts";
import { AttributeBase, } from "../attributes/attribute-base.ts";
import { AttributeDefinition, } from "../attributes/attribute-definition.ts";
import { AttributeType, } from "../attributes/attribute-type.ts";
import { TjTime, } from "../time/tj-time.ts";
import { Scoreboard, } from "../time/scoreboard.ts";
import { WorkingHours, } from "../calendar/working-hours.ts";
import { Limits, } from "../scheduling/limits.ts";
import { ShiftAssignments, } from "../scheduling/shift-assignments.ts";
import { TimeSheets, } from "../scheduling/time-sheets.ts";
import { ReportContext, } from "../reports/report-context.ts";
import { Report, } from "./report.ts";
import { ReportType, } from "./report-type.ts";
import { Task, } from "./task.ts";
import { Resource, } from "./resource.ts";
import { TaskScenario, } from "./task-scenario.ts";
import { ResourceScenario, } from "./resource-scenario.ts";
import { Account, } from "./account.ts";
import { Shift, } from "./shift.ts";
import { Scenario, } from "./scenario.ts";
import { PropertyList, } from "./property-list.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { Log, } from "../log.ts";
import { AppConfig, } from "../app-config.ts";
import { initTj3Config, } from "../tj3-config.ts";
import { VERSION, } from "../version.ts";

// Import attribute registration functions statically (synchronous)
import { registerScenarioAttributes, } from "../model/attributes/scenario-attributes.ts";
import { registerShiftAttributes, } from "../model/attributes/shift-attributes.ts";
import { registerAccountAttributes, } from "../model/attributes/account-attributes.ts";
import { registerResourceAttributes, } from "../model/attributes/resource-attributes.ts";
import { registerTaskAttributes, } from "../model/attributes/task-attributes.ts";
import { registerReportAttributes, } from "../model/attributes/report-attributes.ts";

export class Project implements ProjectLike {
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
  readonly timeSheets: TimeSheets;
  readonly reportContexts: ReportContext[];
  outputDir: string;
  warnTsDeltas: boolean;
  scoreboard: Scoreboard<number | null> | null;
  scoreboardNoLeaves: Scoreboard<number | null> | null;
  resourceAvailability: Scoreboard<boolean> | null;
  readonly costEvents: CostEvent[];
  readonly trackingScenario: string | null;
  hasBookings(_scIdx: number,): boolean {
    return false;
  }
  isProjectionMode(_scIdx: number,): boolean {
    return false;
  }

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

  attributeDefinition(id: string,): AttributeDefinition<unknown> | undefined {
    return this.scenarios.attributeDefinition(id,);
  }

  constructor(
    id: string,
    name: string,
    version: string,
    flatNamespace?: boolean,
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

    // Initialize AppConfig
    initTj3Config();

    // Default project attributes (Ruby defaults from Project.rb)
    this.attributes.set("dailyworkinghours", 8.0,);
    this.attributes.set("yearlyworkingdays", 260.714,);

    // Create PropertySets with flatNamespace control
    const flat = flatNamespace ?? false;
    this.scenarios = new PropertySet(this, true,);
    this.shifts = new PropertySet(this, flat,);
    this.accounts = new PropertySet(this, flat,);
    this.resources = new PropertySet(this, flat,);
    this.tasks = new PropertySet(this, flat,);
    this.reports = new PropertySet(this, flat,);
    this.attributes.set("scheduleGranularity", 3600,);
    this.attributes.set("timezone", TjTime.getTimeZone(),);
    this.attributes.set("weekStartsMonday", true,);
    this.attributes.set("loadUnit", "days",);
    this.attributes.set("currency", "EUR",);
    this.attributes.set("priority", 500,);
    this.attributes.set("rate", 0.0,);
    this.attributes.set("now", TjTime.now().align(3600,),);

    // Register attributes synchronously
    registerScenarioAttributes(this.scenarios,);
    registerShiftAttributes(this.shifts,);
    registerAccountAttributes(this.accounts,);
    registerResourceAttributes(this.resources,);
    registerTaskAttributes(this.tasks,);
    registerReportAttributes(this.reports,);

    // Create initial plan scenario
    const planScenario = new Scenario(this, "plan", "Plan", null,);
    // The scenario attributes are already registered via registerScenarioAttributes on the PropertySet
    // and the Scenario constructor initializes scenarioAttributes via PropertyTreeNode
    // So no additional action needed here
  }

  get scenarioCount(): number {
    return this.scenarios.items;
  }

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

  scenarioIdx(sc: Scenario | string,): number | undefined {
    if (typeof sc === "string") {
      const scenario = this.scenarios.get(sc,);
      return scenario ? scenario.sequenceNo - 1 : undefined;
    }
    return sc.sequenceNo - 1;
  }

  shift(id: string,): Shift | null {
    const prop = this.shifts.get(id,);
    return prop ? (prop as Shift) : null;
  }

  account(id: string,): Account | null {
    const prop = this.accounts.get(id,);
    return prop ? (prop as Account) : null;
  }

  task(id: string,): Task | null {
    const prop = this.tasks.get(id,);
    return prop ? (prop as Task) : null;
  }

  resource(id: string,): Resource | null {
    const prop = this.resources.get(id,);
    return prop ? (prop as Resource) : null;
  }

  report(id: string,): Report | null {
    const prop = this.reports.get(id,);
    return prop ? (prop as Report) : null;
  }

  reportByName(name: string,): Report | null {
    for (const prop of this.reports.toArray()) {
      if (prop.name === name) {
        return prop as Report;
      }
    }
    return null;
  }

  get(name: string,): unknown {
    return this.attributes.get(name,);
  }

  set(name: string, value: unknown,): void {
    this.attributes.set(name, value,);

    if (
      name === "start" || name === "end" || name === "scheduleGranularity" ||
      name === "timezone"
    ) {
      this.reinitializeWorkingHours();
    }
  }

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

  error(
    id: string,
    text: string,
    sfi?: SourceFileInfo | null,
    property?: PropertyLike,
  ): void {
    MessageHandlerInstance.instance.error(id, text, sfi, null, null, null,);
  }

  warning(
    id: string,
    text: string,
    sfi?: SourceFileInfo | null,
    property?: PropertyLike,
  ): void {
    MessageHandlerInstance.instance.warning(id, text, sfi, null, null, null,);
  }

  dailyWorkingHours(): number {
    return Number(this.get("dailyworkinghours",) ?? 8.0,);
  }

  weeklyWorkingDays(): number {
    const workingHours = this.get("workinghours",) as unknown;
    const daily = this.dailyWorkingHours();
    if (workingHours === null || workingHours === undefined) {
      return daily > 0 ? 40 / daily : 5;
    }
    return (workingHours as { weeklyWorkingHours(): number })
      .weeklyWorkingHours() / daily;
  }

  monthlyWorkingDays(): number {
    return Number(this.get("yearlyworkingdays",) ?? 260.714,) / 12.0;
  }

  yearlyWorkingDays(): number {
    return Number(this.get("yearlyworkingdays",) ?? 260.714,);
  }

  slotsToDays(slots: number,): number {
    const granularity = Number(this.get("scheduleGranularity",) ?? 3600,);
    const daily = this.dailyWorkingHours();
    return slots * granularity / (3600 * daily);
  }

  convertToDailyLoad(seconds: number,): number {
    const daily = this.dailyWorkingHours();
    return seconds / (daily * 3600);
  }

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

  dateToIdx(date: TjTime, forceIntoProject: boolean = true,): number {
    const start = this.get("start",) as TjTime | undefined;
    if (!start) {
      return 0;
    }
    const granularity = (this.get("scheduleGranularity",) as number) ?? 3600;
    const diff = date.toSeconds() - start.toSeconds();
    return Math.floor(diff / granularity,);
  }

  isWorkingTime(sbIdx: number,): boolean {
    if (!this.scoreboard) {
      return true;
    }
    return this.scoreboard.get(sbIdx,) === null;
  }

  hasWorkingTime(sbIdx: number,): boolean {
    return this.isWorkingTime(sbIdx,);
  }

  workingDays(interval: { start: number; end: number },): number {
    let workingDays = 0;
    for (let idx = interval.start; idx <= interval.end; idx++) {
      if (this.isWorkingTime(idx,)) {
        workingDays++;
      }
    }
    return workingDays;
  }

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

  collectTimeOffIntervals(
    iv: { start: number; end: number },
    minDuration: number,
  ): unknown {
    return null;
  }

  attributeName(id: string,): string | undefined {
    const attrDef = this.scenarios.attributeDefinition(id,);
    return attrDef?.name;
  }

  journal(query: unknown,): unknown {
    throw new NotYetImplementedError("16", "journal",);
  }

  to_s(): string {
    return `Project(id=${this.id}, name=${this.name}, version=${this.version})`;
  }

  addScenario(_s: Scenario,): void {
    // Scenario is already registered via PropertyTreeNode constructor
    // This matches the pattern of addTask/addResource/addAccount/addShift/addReport
    // which are all no-ops since their constructors auto-register
  }

  addShift(_s: unknown,): void {}

  addAccount(_a: unknown,): void {}

  addTask(_t: unknown,): void {}

  addResource(_r: unknown,): void {}

  addReport(_r: unknown,): void {}

  removeAccount(account: unknown,): void {
    if (account instanceof PropertyTreeNode) {
      this.accounts.removeProperty(account,);
    }
  }

  // 9.8 — Project.generateReports + generateReport + listReports
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
    // DataCache.instance.flush(); // stub
  }

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
      if (dynamicAttributes) {
        // report.backupAttributes(); // stub
        // parseReportAttributes(report, dynamicAttributes); // stub
      }
      (report as Report).generate(formats as string[] | undefined,);
      if (dynamicAttributes) {
        // report.restoreAttributes(...); // stub
      }
      this.reportContexts.pop();
    }
  }

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

  static maxScheduleGranularity(): number {
    return 3600;
  }

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
  checkTimeSheets(): void {
    this.timeSheets.check();
  }

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
      if (taskToRemove) {
        const taskIndex = tasks.itemIndex(taskToRemove,);
        tasks.delete(taskIndex,);
      } else if (failedTasks.length === 0) {
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
