/**
 * Testes de TjpExportRE (Fase 14.18.2).
 *
 * Cobre o construtor, o retorno vazio sem `definitions`, a seção `project` e a
 * emissão das listas de `resource`/`task`. O caminho de `booking` depende do
 * scoreboard do scheduler e não é exercido aqui (Fase 7).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.18.2)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TjpExportRE, } from "../../src/reports/tjp-export-re.ts";

describe("TjpExportRE (14.18.2)", () => {
  let project: Project;
  let report: Report;

  beforeEach(() => {
    project = createTestProject(1,);
    report = new Report(project, "tj", "export.tji", null,);
    report.set("start", TjTime.fromString("2026-01-01",),);
    report.set("end", TjTime.fromString("2026-12-31",),);
    report.set("scenarios", [0,],);
    report.set("sortResources", [],);
    report.set("sortTasks", [],);
    report.set("definitions", [],);
    report.set("resourceAttributes", [],);
    report.set("taskAttributes", [],);
    project.reportContexts.push(new ReportContext(project, report,),);
  },);

  function exportTjp(): string {
    return new TjpExportRE(report,).to_tjp();
  }

  it("retorna vazio quando 'definitions' está vazio (14.18.2.3)", () => {
    new Resource(project, "r1", "R1", null,);
    new Task(project, "t1", "T1", null,);
    assertEquals(exportTjp(), "",);
  });

  it("gera a seção project (14.18.2.5)", () => {
    report.set("definitions", ["project",],);
    const tjp = exportTjp();
    assert(tjp.startsWith("project ",), "cabeçalho project",);
    assert(tjp.includes("timezone",), "timezone presente",);
    assert(tjp.includes("scenario plan",), "cenário plan declarado",);
    assert(tjp.includes("active yes",), "flag active do cenário",);
  });

  it("emite as listas de resources e tasks (14.18.2.9/14.18.2.10)", () => {
    new Resource(project, "r1", "R1", null,);
    new Task(project, "t1", "T1", null,);
    report.set("definitions", ["resources", "tasks",],);
    const tjp = exportTjp();
    assert(tjp.includes("resource r1 " + '"R1"',), "recurso exportado",);
    assert(tjp.includes("task t1 " + '"T1"',), "tarefa exportada",);
  });

  it("declara flags usadas pelas tarefas (14.18.2.6)", () => {
    const task = new Task(project, "t1", "T1", null,);
    task.setForScenario("flags", ["critical",], 0,);
    report.set("definitions", ["flags",],);
    const tjp = exportTjp();
    assert(tjp.includes("flags critical",), "flag declarada",);
  });
});
