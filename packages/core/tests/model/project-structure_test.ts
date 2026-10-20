import { beforeEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertExists } from "@std/assert";
import { Project } from "../../src/model/project.ts";
import { Scenario } from "../../src/model/scenario.ts";
import { Task } from "../../src/model/task.ts";
import { Resource } from "../../src/model/resource.ts";
import { Account } from "../../src/model/account.ts";
import { Shift } from "../../src/model/shift.ts";
import { Report } from "../../src/model/report.ts";

describe("Project structure", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project("test-project", "Test Project", "1.0.0");
  });

  it("constructor initializes PropertySets", () => {
    assertExists(project.scenarios);
    assertExists(project.shifts);
    assertExists(project.accounts);
    assertExists(project.resources);
    assertExists(project.tasks);
    assertExists(project.reports);

    assertEquals(project.scenarios.items, 1); // plan scenario
    assertEquals(project.shifts.items, 0);
    assertEquals(project.accounts.items, 0);
    assertEquals(project.resources.items, 0);
    assertEquals(project.tasks.items, 0);
    assertEquals(project.reports.items, 0);
  });

  it("scenarioCount getter returns correct count", () => {
    assertEquals(project.scenarioCount, 1);

    const scenario2 = new Scenario(project, "scenario2", "Scenario 2", null);
    assertEquals(project.scenarioCount, 2);
  });

  it("scenario(arg) polymorphic access - number", () => {
    const scenario0 = project.scenario(0);
    assertExists(scenario0);
    assertEquals(scenario0.id, "plan");

    const scenario1 = project.scenario(1);
    assertEquals(scenario1, null);

    const scenarioNull = project.scenario(999);
    assertEquals(scenarioNull, null);
  });

  it("scenario(arg) polymorphic access - string", () => {
    const scenario1 = project.scenario("plan");
    assertExists(scenario1);
    assertEquals(scenario1.id, "plan");

    const scenarioNull = project.scenario("nonexistent");
    assertEquals(scenarioNull, null);
  });

  it("get/set attribute access", () => {
    project.set("start", "2026-01-01");
    assertEquals(project.get("start"), "2026-01-01");

    project.set("end", "2026-12-31");
    assertEquals(project.get("end"), "2026-12-31");

    const nonExistent = project.get("nonexistent");
    assertEquals(nonExistent, undefined);
  });

  it("addScenario adds scenario to PropertySet", () => {
    const scenario = new Scenario(project, "custom", "Custom", null);
    assertEquals(project.scenarioCount, 2);

    const found = project.scenario("custom");
    assertExists(found);
    assertEquals(found.id, "custom");
  });

  it("addShift adds shift to PropertySet", () => {
    new Shift(project, "shift1", "Shift 1", null);
    assertEquals(project.shifts.items, 1);

    const found = project.shift("shift1");
    assertExists(found);
    assertEquals(found.id, "shift1");
  });

  it("addAccount adds account to PropertySet", () => {
    new Account(project, "account1", "Account 1", null);
    assertEquals(project.accounts.items, 1);

    const found = project.account("account1");
    assertExists(found);
    assertEquals(found.id, "account1");
  });

  it("addTask adds task to PropertySet", () => {
    new Task(project, "task1", "Task 1", null);
    assertEquals(project.tasks.items, 1);

    const found = project.task("task1");
    assertExists(found);
    assertEquals(found.id, "task1");
  });

  it("addResource adds resource to PropertySet", () => {
    new Resource(project, "resource1", "Resource 1", null);
    assertEquals(project.resources.items, 1);

    const found = project.resource("resource1");
    assertExists(found);
    assertEquals(found.id, "resource1");
  });

  it("addReport adds report to PropertySet", () => {
    new Report(project, "report1", "Report 1", null);
    assertEquals(project.reports.items, 1);

    const found = project.report("report1");
    assertExists(found);
    assertEquals(found.id, "report1");
  });

  it("removeAccount removes account from PropertySet", () => {
    new Account(project, "account1", "Account 1", null);
    assertEquals(project.accounts.items, 1);

    project.removeAccount(project.account("account1")!);
    assertEquals(project.accounts.items, 0);

    const found = project.account("account1");
    assertEquals(found, null);
  });

  it("dailyWorkingHours calculates correctly", () => {
    project.set("weeklyWorkingHours", 40);
    const daily = project.dailyWorkingHours();
    assertEquals(daily, 8);
  });

  it("weeklyWorkingDays returns default 5", () => {
    assertEquals(project.weeklyWorkingDays(), 5);
  });

  it("monthlyWorkingDays calculates correctly", () => {
    const monthly = project.monthlyWorkingDays();
    assertEquals(monthly, 260.714 / 12.0);
  });

  it("yearlyWorkingDays calculates correctly", () => {
    const yearly = project.yearlyWorkingDays();
    assertEquals(yearly, 260.714);
  });

  it("slotsToDays converts correctly", () => {
    project.set("scheduleGranularity", 3600);
    const days = project.slotsToDays(8); // 8 slots = 1 working day (8h)
    assertEquals(days, 1);
  });

  it("convertToDailyLoad converts correctly", () => {
    const dailyLoad = project.convertToDailyLoad(8 * 3600); // 8 hours = 1 working day
    assertEquals(dailyLoad, 1);
  });

  it("idxToDate returns TjTime", () => {
    const date = project.idxToDate(0);
    assertExists(date);
    assertEquals(date.toString(), "2026-01-01");
  });

  it("dateToIdx converts correctly", () => {
    const date = project.idxToDate(0);
    const idx = project.dateToIdx(date);
    assertEquals(idx, 0);
  });

  it("isWorkingTime returns true for working time", () => {
    const isWorking = project.isWorkingTime(0);
    assertEquals(isWorking, true);
  });

  it("hasWorkingTime returns same as isWorkingTime", () => {
    const hasWorking = project.hasWorkingTime(0);
    assertEquals(hasWorking, true);
  });

  it("workingDays counts working days in interval", () => {
    const days = project.workingDays({ start: 0, end: 10 });
    assertEquals(days, 11); // All days are working days by default
  });

  it("getWorkSlots counts work slots in interval", () => {
    const slots = project.getWorkSlots(0, 10);
    assertEquals(slots, 11); // All slots are working by default
  });

  it("attributeName returns attribute name", () => {
    const name = project.attributeName("id");
    assertEquals(name, "ID");

    const nonExistent = project.attributeName("nonexistent");
    assertEquals(nonExistent, undefined);
  });

  it("to_s returns string representation", () => {
    const str = project.to_s();
    assertEquals(str, "Project(id=test-project, name=Test Project, version=1.0.0)");
  });
});