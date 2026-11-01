/**
 * Testes das colunas `note` e `timebasis` (Fase 14 Complemento 14C.1.8/14C.1.9).
 *
 * `note` é atributo RichText de task/resource/material/conta; o modelo já
 * existia desde a Fase 10-C — faltava apenas exercitá-lo em material e conta.
 * `timebasis` deve exibir o valor **resolvido** do cenário
 * (`TaskScenario.resolvedTimebasis`), não o atributo cru (que fica `nil`
 * quando o usuário não declara nada).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md
 *      (14C.1.8 e 14C.1.9, absorvendo 14.25.11/14.25.13)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { Material, } from "../../src/model/material.ts";
import { Account, } from "../../src/model/account.ts";
import { Task, } from "../../src/model/task.ts";
import type { TaskScenario, } from "../../src/model/task-scenario.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { MaterialListRE, } from "../../src/reports/material-list-re.ts";
import { AccountListRE, } from "../../src/reports/account-list-re.ts";
import { TaskListRE, } from "../../src/reports/task-list-re.ts";
import type { ReportTableLine, } from "../../src/reports/report-table-line.ts";

const D = (s: string,) => TjTime.fromString(s,);

/** Relatório pronto para gerar o formato intermediário. */
function makeReport(
  project: Project,
  typeSpec: ReportType | "materialreport",
  columns: TableColumnDefinition[],
): Report {
  const report = new Report(project, "r", "r.html", null,);
  report.typeSpec = typeSpec as never;
  report.set("start", D("2026-01-01",),);
  report.set("end", D("2026-12-31",),);
  report.set("scenarios", [0,],);
  report.set("columns", columns,);
  project.reportContexts.push(new ReportContext(project, report,),);
  return report;
}

/** Texto plano de uma célula (RTI ou string). */
function textOf(line: ReportTableLine, index: number,): string {
  const cell = line.cells[index] as unknown as { text?: unknown } | null;
  const text = cell?.text;
  if (text === null || text === undefined) return "";
  if (typeof text === "string") return text;
  const rti = text as { to_s?: () => string };
  return typeof rti.to_s === "function" ? rti.to_s() : String(text,);
}

describe("coluna note (14C.1.8)", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(1,);
  },);

  it("exibe a nota RichText de um material", () => {
    const steel = new Material(project, "steel", "kg", 2.5,);
    steel.set("unit", "kg",);
    steel.set("note", "Aço estrutural CA-50",);

    const report = makeReport(project, "materialreport", [
      new TableColumnDefinition("name", "Name",),
      new TableColumnDefinition("note", "Note",),
    ],);
    const re = new MaterialListRE(report,);
    re.generateIntermediateFormat();
    const line = re.getTable()!.getLines()[0]!;
    assertEquals(textOf(line, 1,), "Aço estrutural CA-50",);
  });

  it("exibe a nota RichText de uma conta", () => {
    const root = new Account(project, "a1", "A1", null,);
    root.set("note", "Conta de custeio",);

    const report = makeReport(project, ReportType.AccountReport, [
      new TableColumnDefinition("name", "Name",),
      new TableColumnDefinition("note", "Note",),
    ],);
    const re = new AccountListRE(report,);
    re.generateIntermediateFormat();
    const line = re.getTable()!.getLines()[0]!;
    assertEquals(line.property, root,);
    assertEquals(textOf(line, 1,), "Conta de custeio",);
  });
});

describe("coluna timebasis (14C.1.9)", () => {
  let project: Project;
  let task: Task;

  beforeEach(() => {
    project = createTestProject(1,);
    task = new Task(project, "t1", "T1", null,);
  },);

  it("exibe o timebasis resolvido do cenário", () => {
    (task.data[0] as TaskScenario).resolvedTimebasis = "length";

    const report = makeReport(project, ReportType.TaskReport, [
      new TableColumnDefinition("name", "Name",),
      new TableColumnDefinition("timebasis", "Time Basis",),
    ],);
    const re = new TaskListRE(report,);
    re.generateIntermediateFormat();
    const line = re.getTable()!.getLines()[0]!;
    assertEquals(textOf(line, 1,), "length",);
  });

  it("sem timebasis explícito, mostra o default resolvido (duration)", () => {
    const report = makeReport(project, ReportType.TaskReport, [
      new TableColumnDefinition("name", "Name",),
      new TableColumnDefinition("timebasis", "Time Basis",),
    ],);
    const re = new TaskListRE(report,);
    re.generateIntermediateFormat();
    const line = re.getTable()!.getLines()[0]!;
    assert(textOf(line, 1,).length > 0, "célula vazia",);
    assertEquals(textOf(line, 1,), "duration",);
  });
});
