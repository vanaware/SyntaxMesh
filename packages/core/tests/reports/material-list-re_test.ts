/**
 * Testes de MaterialListRE (Fase 14 Complemento C1.4).
 *
 * Cobre o registro da fábrica (`materialreport`), a geração de uma linha por
 * material, as colunas padrão (`no`, `name`, `unit`, `unitprice`, `totalcost`)
 * e o dispatch real via `Report.generateIntermediateFormat`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.1.4)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { Material, } from "../../src/model/material.ts";
import { Task, } from "../../src/model/task.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { CostEvent, } from "../../src/model/cost-event.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { MaterialListRE, } from "../../src/reports/material-list-re.ts";
import type { ReportTableLine, } from "../../src/reports/report-table-line.ts";
import { contentFactories, } from "../../src/model/report-content.ts";

/** Colunas padrão do materialreport (espelha `parser/rules/report.ts`). */
function defaultColumns(): TableColumnDefinition[] {
  return [
    new TableColumnDefinition("no", "No.",),
    new TableColumnDefinition("name", "Name",),
    new TableColumnDefinition("unit", "Unit",),
    new TableColumnDefinition("unitprice", "Unit Price",),
    new TableColumnDefinition("totalcost", "Total Cost",),
  ];
}

/** Relatório `materialreport` pronto para gerar o formato intermediário. */
function makeReport(
  project: Project,
  columns: TableColumnDefinition[] = defaultColumns(),
  start: string = "2026-01-01",
  end: string = "2026-12-31",
): Report {
  const report = new Report(project, "mr", "mr", null,);
  report.typeSpec = "materialreport" as never;
  report.set("start", TjTime.fromString(start,),);
  report.set("end", TjTime.fromString(end,),);
  report.set("scenarios", [0,],);
  report.set("columns", columns,);
  project.reportContexts.push(new ReportContext(project, report,),);
  return report;
}

/** Cria um material com atributos canônicos (unit/cost). */
function makeMaterial(
  project: Project,
  id: string,
  unit: string,
  unitPrice: number,
): Material {
  const material = new Material(project, id, unit, unitPrice,);
  material.set("unit", unit,);
  material.set("cost", unitPrice,);
  return material;
}

/**
 * Aloca `quantity` do material numa tarefa (14C.11.10: a quantidade do
 * material vem das alocações; `totalquantity` foi removido).
 */
function allocate(
  project: Project,
  material: Material,
  quantity: number,
  taskId = "t0",
): Task {
  const task = new Task(project, taskId, taskId, null,);
  task.setForScenario(
    "materialallocations",
    [new MaterialAllocation(material, quantity, "distributed",),],
    0,
  );
  return task;
}

/** Texto de cada célula não-nula de uma linha. */
function cellTexts(line: ReportTableLine,): string[] {
  return line.cells.map((cell,) => {
    const c = cell as unknown as { text?: string | null };
    return c.text ?? "";
  },);
}

describe("MaterialListRE (14C.1.4)", () => {
  let project: Project;
  let steel: Material;
  let concrete: Material;

  beforeEach(() => {
    project = createTestProject(1,);
    steel = makeMaterial(project, "steel", "kg", 2.5,);
    concrete = makeMaterial(project, "concrete", "m3", 80,);
  },);

  describe("registro na fábrica", () => {
    it("registra `materialreport` como fábrica de conteúdo", () => {
      assert(
        contentFactories.get("materialreport",),
        "fábrica materialreport ausente",
      );
    });
  });

  describe("geração da lista", () => {
    it("gera uma linha por material, na ordem de inserção", () => {
      const report = makeReport(project,);
      const re = new MaterialListRE(report,);
      re.generateIntermediateFormat();
      const lines = re.getTable()!.getLines();
      assertEquals(lines.length, 2,);
      assertEquals(lines[0]!.property, steel,);
      assertEquals(lines[1]!.property, concrete,);
    });

    it("preenche as colunas padrão sem erros de célula", () => {
      allocate(project, steel, 100,);
      const report = makeReport(project,);
      const re = new MaterialListRE(report,);
      re.generateIntermediateFormat();
      const line = re.getTable()!.getLines()[0]!;
      const texts = cellTexts(line,);
      assertEquals(texts.length, 5,);
      assertEquals(texts[0], "1",); // no
      assertEquals(texts[1], "steel",); // name
      assertEquals(texts[2], "kg",); // unit
      assertEquals(texts[3], "2.5",); // unitprice (cost, float do núcleo)
      assertEquals(texts[4], "250",); // totalcost (100 × 2.5 da alocação)
      assert(
        !texts.includes("<Error>",),
        `célula com erro: ${texts.join(" | ",)}`,
      );
    });
  });

  describe("colunas de alocação e custo (14C.1.5)", () => {
    function setupTask(): Task {
      const task = new Task(project, "t1", "Task 1", null,);
      task.setForScenario(
        "materialallocations",
        [new MaterialAllocation(steel, 200, "distributed",),],
        0,
      );
      return task;
    }

    it("coluna allocations lista tarefas consumidoras com quantidade", () => {
      setupTask();
      const report = makeReport(project, [
        new TableColumnDefinition("name", "Name",),
        new TableColumnDefinition("allocations", "Allocations",),
      ],);
      const re = new MaterialListRE(report,);
      re.generateIntermediateFormat();
      const texts = cellTexts(re.getTable()!.getLines()[0]!,);
      assertEquals(texts[1], "t1 (200)",);
    });

    it("allocations vazio não marca erro de célula", () => {
      const report = makeReport(project, [
        new TableColumnDefinition("name", "Name",),
        new TableColumnDefinition("allocations", "Allocations",),
      ],);
      const re = new MaterialListRE(report,);
      re.generateIntermediateFormat();
      for (const line of re.getTable()!.getLines()) {
        assertEquals(cellTexts(line,)[1], "",);
      }
    });

    it("scheduledcost/actualcost somam CostEvents por modo; total soma ambos", () => {
      const task = setupTask();
      project.costEvents.push(
        new CostEvent(
          "material_usage",
          100,
          null,
          "explicit",
          0,
          "planned",
          task,
          undefined,
          steel,
        ),
        new CostEvent(
          "material_usage",
          50,
          null,
          "explicit",
          0,
          "actual",
          task,
          undefined,
          steel,
        ),
      );
      const report = makeReport(project, [
        new TableColumnDefinition("name", "Name",),
        new TableColumnDefinition("scheduledcost", "Scheduled",),
        new TableColumnDefinition("actualcost", "Actual",),
        new TableColumnDefinition("totalcost", "Total",),
      ],);
      const re = new MaterialListRE(report,);
      re.generateIntermediateFormat();
      const texts = cellTexts(re.getTable()!.getLines()[0]!,);
      assertEquals(texts[1], "100",);
      assertEquals(texts[2], "50",);
      assertEquals(texts[3], "150",);
    });

    it("sem CostEvents, totalcost vem das alocações (14C.11.10)", () => {
      allocate(project, steel, 100,);
      const report = makeReport(project, [
        new TableColumnDefinition("name", "Name",),
        new TableColumnDefinition("totalcost", "Total",),
      ],);
      const re = new MaterialListRE(report,);
      re.generateIntermediateFormat();
      assertEquals(cellTexts(re.getTable()!.getLines()[0]!,)[1], "250",);
    });

    it("id/name/note/unit/unitprice usam atributos canônicos", () => {
      steel.set("note", "aço estrutural",);
      const report = makeReport(project, [
        new TableColumnDefinition("id", "Id",),
        new TableColumnDefinition("name", "Name",),
        new TableColumnDefinition("note", "Note",),
        new TableColumnDefinition("unit", "Unit",),
        new TableColumnDefinition("unitprice", "Unit Price",),
      ],);
      const re = new MaterialListRE(report,);
      re.generateIntermediateFormat();
      const texts = cellTexts(re.getTable()!.getLines()[0]!,);
      assertEquals(texts[0], "steel",);
      assertEquals(texts[1], "steel",);
      assertEquals(texts[2], "aço estrutural",);
      assertEquals(texts[3], "kg",);
      assertEquals(texts[4], "2.5",);
    });
  });

  describe("agregação por período (14C.1.6)", () => {
    function addTask(id: string, start: string, end: string,): Task {
      const task = new Task(project, id, id, null,);
      task.setForScenario("start", TjTime.fromString(start,), 0,);
      task.setForScenario("end", TjTime.fromString(end,), 0,);
      task.setForScenario(
        "materialallocations",
        [new MaterialAllocation(steel, 100, "distributed",),],
        0,
      );
      return task;
    }

    it("recorta o custo de material pelas tarefas dentro do período", () => {
      addTask("fev", "2026-02-01", "2026-02-10",);
      addTask("jun", "2026-06-01", "2026-06-10",);
      const report = makeReport(
        project,
        [
          new TableColumnDefinition("name", "Name",),
          new TableColumnDefinition("scheduledcost", "Scheduled",),
        ],
        "2026-01-01",
        "2026-02-28",
      );
      const re = new MaterialListRE(report,);
      re.generateIntermediateFormat();
      // Só a tarefa de fevereiro cruza o período: 100 × 2.5 = 250.
      assertEquals(cellTexts(re.getTable()!.getLines()[0]!,)[1], "250",);
    });

    it("período cobrindo o projeto soma todas as alocações", () => {
      addTask("fev", "2026-02-01", "2026-02-10",);
      addTask("jun", "2026-06-01", "2026-06-10",);
      const report = makeReport(project, [
        new TableColumnDefinition("name", "Name",),
        new TableColumnDefinition("totalcost", "Total",),
      ],);
      const re = new MaterialListRE(report,);
      re.generateIntermediateFormat();
      // Ambas as tarefas no período do projeto: (100 + 100) × 2.5 = 500.
      assertEquals(cellTexts(re.getTable()!.getLines()[0]!,)[1], "500",);
    });
  });

  describe("dispatch via Report", () => {
    it("Report.generateIntermediateFormat instancia MaterialListRE", () => {
      const report = makeReport(project,);
      report.generateIntermediateFormat();
      assert(report.content instanceof MaterialListRE,);
      const table = (report.content as MaterialListRE).getTable();
      assertEquals(table!.getLines().length, 2,);
    });
  });
});
