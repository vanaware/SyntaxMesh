import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertExists, assertThrows, } from "@std/assert";
import { TaskJuggler, } from "../src/taskjuggler.ts";
import { Project, } from "../src/model/project.ts";
import { createTestProject, } from "./fixtures/create-test-project.ts";
import { TjTime, } from "../src/time/tj-time.ts";
import { Task, } from "../src/model/task.ts";
import { NotYetImplementedError, } from "../src/model/errors.ts";
import { MessageHandlerInstance, } from "../src/message-handler.ts";

describe("TaskJuggler", () => {
  let tj: TaskJuggler;

  beforeEach(() => {
    tj = new TaskJuggler();
  },);

  it("constructor seta UTC", () => {
    assertEquals(TjTime.getTimeZone(), "UTC",);
  });

  it("constructor defaults", () => {
    assertEquals(tj.maxCpuCores, 1,);
    assertEquals(tj.warnTsDeltas, false,);
    assertEquals(tj.generateTraces, false,);
    assertEquals(tj.project, null,);
    assertEquals(tj.parser, null,);
  });

  it("parse lança NotYetImplemented", () => {
    assertThrows(() => tj.parse(["file.tjp",],), NotYetImplementedError,);
  });

  it("freeze lança NotYetImplemented", () => {
    assertThrows(
      () => tj.freeze(TjTime.now(), false,),
      NotYetImplementedError,
    );
  });

  it("checkTimeSheet lança NotYetImplemented", () => {
    assertThrows(() => tj.checkTimeSheet("ts.tji",), NotYetImplementedError,);
  });

  it("checkStatusSheet lança NotYetImplemented", () => {
    assertThrows(() => tj.checkStatusSheet("ss.tji",), NotYetImplementedError,);
  });

  it("projectId/projectName null sem project", () => {
    assertEquals(tj.projectId, null,);
    assertEquals(tj.projectName, null,);
  });

  it("projectId/projectName com project", () => {
    const project = createTestProject();
    tj.project = project;
    assertEquals(tj.projectId, "test",);
    assertEquals(tj.projectName, "Test Project",);
  });

  it("schedule delega para project", () => {
    const project = createTestProject();
    project.set("start", TjTime.fromString("2026-01-01",),);
    project.set("end", TjTime.fromString("2026-12-31",),);
    new Task(project, "task1", "Task 1", null,);
    tj.project = project;
    tj.warnTsDeltas = true;
    assertEquals(tj.schedule(), true,);
  });

  it("generateReports delega para project", () => {
    const project = createTestProject();
    project.set("start", TjTime.fromString("2026-01-01",),);
    project.set("end", TjTime.fromString("2026-12-31",),);
    new Task(project, "task1", "Task 1", null,);
    tj.project = project;
    assertEquals(tj.generateReports(), true,);
  });

  it("generateReports seta outputDir", () => {
    const project = createTestProject();
    project.set("start", TjTime.fromString("2026-01-01",),);
    project.set("end", TjTime.fromString("2026-12-31",),);
    new Task(project, "task1", "Task 1", null,);
    tj.project = project;
    tj.generateReports("/output",);
    assertEquals(project.outputDir, "/output/",);
  });

  it("generateReport delega", () => {
    const project = createTestProject();
    project.set("start", TjTime.fromString("2026-01-01",),);
    project.set("end", TjTime.fromString("2026-12-31",),);
    new Task(project, "task1", "Task 1", null,);
    tj.project = project;
    // No reports: checkReports warns but generateReports iterates empty
    assertEquals(tj.generateReport("report1", false,), true,);
  });

  it("listReports delega", () => {
    const project = createTestProject();
    project.set("start", TjTime.fromString("2026-01-01",),);
    project.set("end", TjTime.fromString("2026-12-31",),);
    new Task(project, "task1", "Task 1", null,);
    tj.project = project;
    assertEquals(tj.listReports("report1", false,), true,);
  });

  it("errors getter reflete o MessageHandler (TaskJuggler.rb:384)", () => {
    // Antes era um stub `return 0`; agora espelha a contagem real do handler.
    MessageHandlerInstance.instance.reset();
    assertEquals(tj.errors, 0,);
    MessageHandlerInstance.instance.error("probe", "boom",);
    assertEquals(tj.errors, 1,);
    MessageHandlerInstance.instance.reset();
  });
});
