import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assert, assertThrows } from "@std/assert";
import { MockProject } from "./mock-project.ts";
import { Report } from "../../src/model/report.ts";
import { ReportScenario } from "../../src/model/report-scenario.ts";
import { ReportType } from "../../src/model/report-type.ts";

describe("Report", () => {
  let project: MockProject;

  beforeEach(() => {
    project = new MockProject(2);
  });

  it("enum ReportType tem 11 valores", () => {
    assertEquals(ReportType.AccountReport, "AccountReport");
    assertEquals(ReportType.Export, "Export");
    assertEquals(ReportType.ICal, "ICal");
    assertEquals(ReportType.Niku, "Niku");
    assertEquals(ReportType.ResourceReport, "ResourceReport");
    assertEquals(ReportType.TagFile, "TagFile");
    assertEquals(ReportType.TextReport, "TextReport");
    assertEquals(ReportType.TaskReport, "TaskReport");
    assertEquals(ReportType.TraceReport, "TraceReport");
    assertEquals(ReportType.StatusSheet, "StatusSheet");
    assertEquals(ReportType.TimeSheet, "TimeSheet");
  });

  it("cria relatório com id e nome", () => {
    const report = new Report(project, "report1", "Report 1", null);
    assertEquals(report.id, "report1");
    assertEquals(report.name, "Report 1");
    assertEquals(report.level, 0);
    assertEquals(report.typeSpec, null);
    assertEquals(report.content, null);
  });

  it("relatório herda de PropertyTreeNode", () => {
    const report = new Report(project, "report1", "Report 1", null);
    assertEquals(report.project, project);
    assertEquals(report.parents()[0], undefined);
  });

  it("relatório all() inclui self", () => {
    const report = new Report(project, "report1", "Report 1", null);
    assertEquals(report.all().length, 1);
    assertEquals(report.all()[0], report);
  });

  it("relatório allLeaves(withoutSelf=false) inclui self se folha", () => {
    const report = new Report(project, "report1", "Report 1", null);
    assertEquals(report.allLeaves(false).length, 1);
    assertEquals(report.allLeaves(false)[0], report);
  });

  it("relatório allLeaves(withoutSelf=true) exclui self", () => {
    const report = new Report(project, "report1", "Report 1", null);
    assertEquals(report.allLeaves(true).length, 0);
  });

  it("cria cenário para relatório", () => {
    const report = new Report(project, "report1", "Report 1", null);
    const scenario = report.scenarioData(0);
    assert(scenario instanceof ReportScenario);
  });

  it("cenario NÃO pré-carrega atributos (sem preload)", () => {
    const report = new Report(project, "report1", "Report 1", null);
    const scenario = report.scenarioData(0);
    assert(scenario.a("caption") === undefined);
    assert(scenario.a("title") === undefined);
  });

  it("getScenarioAttribute lança para atributo não específico de cenário", () => {
    const report = new Report(project, "report1", "Report 1", null);
    try {
      report.getScenarioAttribute(0, "caption");
      assert(false, "Deveria ter lançado");
    } catch (e) {
      assert(e instanceof Error);
    }
  });

  it("getScenarioAttribute lança para atributo não específico de cenário (id)", () => {
    const report = new Report(project, "report1", "Report 1", null);
    try {
      report.getScenarioAttribute(0, "id");
      assert(false, "Deveria ter lançado");
    } catch (e) {
      assert(e instanceof Error);
    }
  });

  it("setForScenario lança para qualquer atributo (Report não tem atributos específicos de cenário)", () => {
    const report = new Report(project, "report1", "Report 1", null);
    assertThrows(
      () => report.setForScenario("caption", "My Report", 0),
      Error,
    );
    assertThrows(
      () => report.setForScenario("id", "newid", 0),
      Error,
    );
  });

  it("setForScenario lança para atributo não específico de cenário", () => {
    const report = new Report(project, "report1", "Report 1", null);
    try {
      report.setForScenario("id", "newid", 0);
      assert(false, "Deveria ter lançado");
    } catch (e) {
      assert(e instanceof Error);
    }
  });

  it("relatório com pai herda nível", () => {
    const parent = new Report(project, "parent", "Parent", null);
    const child = new Report(project, "child", "Child", parent);
    assertEquals(child.level, 1);
  });

  it("relatório com pai herda fullId", () => {
    const parent = new Report(project, "parent", "Parent", null);
    const child = new Report(project, "child", "Child", parent);
    assertEquals(child.fullId, "parent.child");
  });

  it("checkFileName rejeita caracteres inválidos", () => {
    const report = new Report(project, "report1", "Report 1", null);
    assertThrows(() => report.checkFileName("file?name"), Error);
    assertThrows(() => report.checkFileName("file*name"), Error);
    assertThrows(() => report.checkFileName("file:name"), Error);
    assertThrows(() => report.checkFileName("file\"name"), Error);
    assertThrows(() => report.checkFileName("file<name>"), Error);
    assertThrows(() => report.checkFileName("file|name"), Error);
    assertThrows(() => report.checkFileName("file%name"), Error);
  });

  it("checkFileName aceita nomes válidos", () => {
    const report = new Report(project, "report1", "Report 1", null);
    report.checkFileName("valid.txt");
    report.checkFileName("valid-file");
    report.checkFileName("valid_file");
    report.checkFileName("valid.file.name");
  });

  it("absoluteFileName retorna absoluto se já absoluto", () => {
    const report = new Report(project, "report1", "Report 1", null);
    assertEquals(report.absoluteFileName("/absolute/path"), "/absolute/path");
  });

  it("absoluteFileName prepend outputDir se relativo", () => {
    const report = new Report(project, "report1", "Report 1", null);
    project.set("outputDir", "/output");
    assertEquals(report.absoluteFileName("relative.txt"), "/output/relative.txt");
  });

  it("absoluteFileNameExists retorna true para absoluto", () => {
    const report = new Report(project, "report1", "Report 1", null);
    assertEquals(report.absoluteFileNameExists("/absolute/path"), true);
    assertEquals(report.absoluteFileNameExists("relative.txt"), false);
  });

  it("relatório com id hierárquico resolve pai do PropertySet", () => {
    const report = new Report(project, "parent.child", "Child", null);
    assertEquals(report.fullId, "parent.child");
    assertEquals(report.subId, "child");
  });

  it("relatório com id hierárquico resolve pai do PropertySet (já existente)", () => {
    const existing = new Report(project, "parent", "Parent", null);
    const report = new Report(project, "parent.child", "Child", null);
    assertEquals(report.parent, existing);
  });

  it("relatório com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true", () => {
    const project2 = new MockProject(1, true);
    const existing = new Report(project2, "parent", "Parent", null);
    const report = new Report(project2, "parent.child", "Child", null);
    assertEquals(report.fullId, "parent.child");
    assertEquals(report.subId, "parent.child");
  });

  it("relatório com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, id com múltiplos pontos", () => {
    const project2 = new MockProject(1, true);
    const existing = new Report(project2, "parent", "Parent", null);
    const report = new Report(project2, "parent.child.grandchild", "Grandchild", null);
    assertEquals(report.fullId, "parent.child.grandchild");
    assertEquals(report.subId, "parent.child.grandchild");
  });

  it("relatório com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, parent does not exist", () => {
    const project2 = new MockProject(1, false);
    const report = new Report(project2, "nonexistent.child", "Child", null);
    assertEquals(report.fullId, "nonexistent.child");
    assertEquals(report.subId, "child");
  });

  it("relatório com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, parent does not exist", () => {
    const project2 = new MockProject(1, true);
    const report = new Report(project2, "nonexistent.child", "Child", null);
    assertEquals(report.fullId, "nonexistent.child");
    assertEquals(report.subId, "nonexistent.child");
  });

  it("relatório com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, child already exists", () => {
    const project2 = new MockProject(1, false);
    const existing = new Report(project2, "child", "Child", null);
    const report = new Report(project2, "nonexistent.child", "Child", null);
    assertEquals(report.fullId, "nonexistent.child");
    assertEquals(report.subId, "child");
  });

  it("relatório com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, child already exists", () => {
    const project2 = new MockProject(1, true);
    const existing = new Report(project2, "child", "Child", null);
    const report = new Report(project2, "nonexistent.child", "Child", null);
    assertEquals(report.fullId, "nonexistent.child");
    assertEquals(report.subId, "nonexistent.child");
  });

  it("relatório com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, child already exists, parent already exists", () => {
    const project2 = new MockProject(1, false);
    const parent = new Report(project2, "parent", "Parent", null);
    const existing = new Report(project2, "parent.child", "Child", null);
    const report = new Report(project2, "parent.child", "Child", null);
    assertEquals(report.fullId, "parent.child");
    assertEquals(report.subId, "child");
  });

  it("relatório com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, child already exists, parent already exists", () => {
    const project2 = new MockProject(1, true);
    const parent = new Report(project2, "parent", "Parent", null);
    const existing = new Report(project2, "parent.child", "Child", null);
    const report = new Report(project2, "parent.child", "Child", null);
    assertEquals(report.fullId, "parent.child");
    assertEquals(report.subId, "parent.child");
  });
});
