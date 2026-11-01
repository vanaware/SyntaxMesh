/**
 * Testes do `export`/TjpExportRE com materiais (Fase 14 Complemento 14C.1.13).
 *
 * Cobre a extensão SyntaxMesh ao TjpExportRE: `definitions materials` emite
 * `material <id> "<nome>" { unit/unitprice/totalquantity/flags/note }` e
 * `taskattributes materialallocations` emite `material <id> <qtd>
 * [modificador]` dentro do bloco da tarefa. O round-trip
 * parse → export → parse preserva os dados; sem materiais a saída não muda.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.1.13)
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { parseProject, PROJECT_HEADER, } from "../parser/parse-helper.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import type { Material, } from "../../src/model/material.ts";
import type { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TjpExportRE, } from "../../src/reports/tjp-export-re.ts";

const SOURCE = PROJECT_HEADER +
  "flags critical\n" +
  'material steel "steel" {\n' +
  '  unit "kg"\n' +
  "  unitprice 2.5\n" +
  "  totalquantity 100\n" +
  "  flags critical\n" +
  "}\n" +
  'task t1 "T1" {\n' +
  "  start 2026-01-05\n" +
  "  end 2026-01-09\n" +
  "  material steel 200 onstart\n" +
  "}\n";

/** Monta um relatório de export pronto para uso. */
function exportReport(
  project: Project,
  definitions: string[],
  taskAttributes: string[],
): Report {
  const report = new Report(project, "tj", "export.tji", null,);
  report.set("start", TjTime.fromString("2026-01-01",),);
  report.set("end", TjTime.fromString("2026-12-31",),);
  report.set("scenarios", [0,],);
  report.set("sortResources", [],);
  report.set("sortTasks", [],);
  report.set("definitions", definitions,);
  report.set("resourceAttributes", [],);
  report.set("taskAttributes", taskAttributes,);
  project.reportContexts.push(new ReportContext(project, report,),);
  return report;
}

describe("TjpExportRE com materiais (14C.1.13)", () => {
  it("exporta material e materialallocations e faz round-trip", () => {
    const parsed = parseProject(SOURCE,);
    assertEquals(
      parsed.threw,
      null,
      `messages=${parsed.messageIds.join(",",)}`,
    );
    const project = parsed.result as Project;

    const tjp = new TjpExportRE(
      exportReport(project, ["flags", "materials", "tasks",], [
        "materialallocations",
      ],),
    ).to_tjp();

    // Declaração do material com os atributos canônicos.
    assert(tjp.includes('material steel "steel" {',), `declaração:\n${tjp}`,);
    assert(tjp.includes('unit "kg"',), `unit:\n${tjp}`,);
    assert(tjp.includes("unitprice 2.5",), `unitprice:\n${tjp}`,);
    assert(tjp.includes("totalquantity 100",), `totalquantity:\n${tjp}`,);
    // Alocação dentro do bloco da tarefa (com modificador não-padrão).
    assert(tjp.includes("material steel 200 onstart",), `alocação:\n${tjp}`,);

    // Round-trip: parse do export preserva material e flags. As tarefas ficam
    // de fora porque `DateAttribute#to_tjp` emite `date <valor>` (fiel ao
    // Ruby) — `start`/`end` nunca foram round-trip-áveis pelo TjpExportRE.
    const roundTrip = new TjpExportRE(
      exportReport(project, ["flags", "materials",], [],),
    ).to_tjp();
    const again = parseProject(PROJECT_HEADER + roundTrip,);
    assertEquals(
      again.messageIds,
      [],
      `round-trip falhou: ${again.messageIds.join(",",)}`,
    );
    const reparsed = again.result as Project;
    const steel = reparsed.material("steel",) as Material;
    assert(steel, "material steel re-importado",);
    assertEquals(steel.get("unit",), "kg",);
    assertEquals(steel.get("cost",), 2.5,);
    assertEquals(steel.get("totalquantity",), 100,);
    assertEquals(steel.getForScenario("flags", 0,), ["critical",],);

    const task = reparsed.task("t1",);
    assertEquals(task, null,);

    // A linha da alocação exportada, quando relida pelo parser, reconstrói o
    // `MaterialAllocation` com o modificador original.
    const allocationLine = tjp.split("\n",).find((line,) =>
      line.trim().startsWith("material steel 200",)
    );
    assert(allocationLine, `linha de alocação ausente:\n${tjp}`,);
    const allocParsed = parseProject(
      PROJECT_HEADER + roundTrip + 'task t1 "T1" {\n  ' +
        allocationLine!.trim() + "\n}\n",
    );
    assertEquals(
      allocParsed.messageIds,
      [],
      `alocação re-lida: ${allocParsed.messageIds.join(",",)}`,
    );
    const allocTask = (allocParsed.result as Project).task("t1",)!;
    const allocations = allocTask.getForScenario(
      "materialallocations",
      0,
    ) as MaterialAllocation[];
    assertEquals(allocations.length, 1,);
    const allocation = allocations[0]!;
    assertEquals(allocation.material.id, "steel",);
    assertEquals(allocation.quantity, 200,);
    assertEquals(allocation.modifier, "onstart",);
  });

  it("sem materiais a saída permanece sem menções a material", () => {
    const parsed = parseProject(
      PROJECT_HEADER + 'task t1 "T1" {\n  start 2026-01-05\n  duration 2d\n}\n',
    );
    assertEquals(
      parsed.threw,
      null,
      `messages=${parsed.messageIds.join(",",)}`,
    );
    const project = parsed.result as Project;
    assertEquals(project.materials.toArray().length, 0,);

    const tjp = new TjpExportRE(
      exportReport(project, ["flags", "materials", "tasks",], [
        "materialallocations",
      ],),
    ).to_tjp();

    assert(tjp.includes('task t1 "T1" {',), `tarefa exportada:\n${tjp}`,);
    assert(!tjp.includes("material ",), `saída inesperada:\n${tjp}`,);
  });
});
