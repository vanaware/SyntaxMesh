/**
 * Testes de NikuReport (Fase 14.20.1).
 *
 * Foca nas três saídas (to_niku/to_html/to_csv) e nos helpers de soma
 * (sum/resourceTotal/projectTotal/total) usando uma subclasse que popula as
 * estruturas intermediárias diretamente — o caminho completo depende dos
 * atributos customizados `ClarityRID`/`ClarityPID`/`ClarityPName`, que só
 * existem após um `extend task`/`extend resource` no parser (coberto em
 * testes de parser).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.20.1)
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
import {
  NikuProject,
  NikuReport,
  NikuResource,
} from "../../src/reports/niku-report.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { contentFactories, } from "../../src/model/report-content.ts";

/** Subclasse que permite popular as estruturas internas sem parser. */
class TestNikuReport extends NikuReport {
  seed(
    projects: Iterable<NikuProject>,
    resources: Iterable<[string, Resource,]>,
    totals: Iterable<[string, number,]>,
    free: Iterable<[string, number,]>,
  ): void {
    for (const p of projects) this.projects.set(p.id, p,);
    for (const [id, r,] of resources) this.resources.set(id, r,);
    for (const [id, n,] of totals) this.resourcesTotalEffort.set(id, n,);
    for (const [id, n,] of free) this.resourcesFreeWork.set(id, n,);
  }
}

function makeNiku(id: string, name: string,): NikuProject {
  return new NikuProject(id, name,);
}

function resourceAllocation(
  prj: NikuProject,
  rid: string,
  sum: number,
): NikuResource {
  const r = new NikuResource(rid,);
  r.sum = sum;
  prj.resources.set(rid, r,);
  return r;
}

describe("NikuReport (14.20.1)", () => {
  let project: Project;
  let report: Report;

  beforeEach(() => {
    project = createTestProject(1,);
    report = new Report(project, "niku", "niku.xml", null,);
    report.typeSpec = ReportType.Niku;
    report.set("start", TjTime.fromString("2026-01-01",),);
    report.set("end", TjTime.fromString("2026-02-01",),);
    report.set("scenarios", [0,],);
    report.set("sortTasks", [],);
    report.set("sortResources", [],);
    project.reportContexts.push(new ReportContext(project, report,),);
  },);

  describe("helpers de soma (14.20.1.2 / 14.20.1.4)", () => {
    it("sum retorna 0 para projeto/recurso desconhecidos", () => {
      const r = new Resource(project, "r1", "R1", null,);
      const niku = new TestNikuReport(report,);
      niku.seed([], [], [["rid1", 10,],], [],);
      assertEquals(niku.sum("nope", "rid1",), 0.0,);
      assertEquals(niku.sum("nope", "unknown",), 0.0,);
      // Recurso conhecido mas sem alocação no projeto → 0.
      const prj = makeNiku("P1", "Project One",);
      niku.seed([prj,], [["rid1", r,],], [["rid1", 10,],], [],);
      assertEquals(niku.sum("P1", "rid1",), 0.0,);
    });

    it("sum = alocação do recurso / esforço total do recurso", () => {
      const r = new Resource(project, "r1", "R1", null,);
      const prj = makeNiku("P1", "Project One",);
      resourceAllocation(prj, "rid1", 3.0,);
      const niku = new TestNikuReport(report,);
      niku.seed([prj,], [["rid1", r,],], [["rid1", 10.0,],], [],);
      assertEquals(niku.sum("P1", "rid1",), 0.3,);
    });

    it("projectTotal/total agregam sobre os recursos conhecidos", () => {
      const r1 = new Resource(project, "r1", "R1", null,);
      const r2 = new Resource(project, "r2", "R2", null,);
      const p1 = makeNiku("P1", "One",);
      resourceAllocation(p1, "rid1", 4.0,);
      resourceAllocation(p1, "rid2", 2.0,);
      const niku = new TestNikuReport(report,);
      niku.seed(
        [p1,],
        [["rid1", r1,], ["rid2", r2,],],
        [["rid1", 10.0,], ["rid2", 10.0,],],
        [],
      );
      // 4/10 + 2/10 = 0.6 (com tolerância de ponto flutuante).
      const pt = niku.projectTotal("P1",);
      assert(Math.abs(pt - 0.6,) < 1e-9, `${pt}`,);
      assert(Math.abs(niku.total() - 0.6,) < 1e-9,);
    });

    it("resourceTotal agrega um recurso ao longo de vários projetos", () => {
      const r = new Resource(project, "r1", "R1", null,);
      const p1 = makeNiku("P1", "One",);
      const p2 = makeNiku("P2", "Two",);
      resourceAllocation(p1, "rid1", 1.0,);
      resourceAllocation(p2, "rid1", 2.0,);
      const niku = new TestNikuReport(report,);
      niku.seed(
        [p1, p2,],
        [["rid1", r,],],
        [["rid1", 10.0,],],
        [],
      );
      assert(Math.abs(niku.resourceTotal("rid1",) - 0.3,) < 1e-9,);
    });
  });

  describe("to_niku (14.20.1.3 / 14.20.1.6)", () => {
    function buildOne(): TestNikuReport {
      const r = new Resource(project, "r1", "R1", null,);
      const p = makeNiku("P1", "Alpha",);
      resourceAllocation(p, "rid1", 5.0,);
      const niku = new TestNikuReport(report,);
      niku.seed([p,], [["rid1", r,],], [["rid1", 10.0,],], [],);
      return niku;
    }

    it("produce um <NikuDataBus> com header action=write e objectType=project", () => {
      const xml = buildOne().to_niku();
      assert(
        xml.includes("<NikuDataBus ",),
        `xml starts: ${xml.slice(0, 80,)} `,
      );
      assert(xml.includes(`action="write"`,),);
      assert(xml.includes(`objectType="project"`,),);
      assert(xml.includes(`version="7.5.0"`,),);
      assert(xml.includes("<Projects>",),);
      assert(xml.includes("</Projects>",),);
    });

    it("emite <Project>, <Resources>, <Resource> e <AllocCurve><Segment>", () => {
      const xml = buildOne().to_niku();
      assert(xml.includes(`projectID="P1"`,),);
      assert(xml.includes(`name="Alpha"`,),);
      assert(xml.includes("<Resources>",),);
      assert(xml.includes(`resourceID="rid1"`,),);
      assert(xml.includes("<AllocCurve>",),);
      assert(xml.includes(`start="2026-01-01T00:00:00"`,),);
      // finish = end - 1s → 2026-01-31T23:59:59
      assert(xml.includes(`finish="2026-01-31T23:59:59"`,),);
      // sum format default: sem numberFormat → `String(0.5)` → "0.5".
      assert(xml.includes(`sum="0.5"`,), xml.slice(xml.indexOf("<Segment",),),);
    });

    it("comenta cabeçalho com softwareName e nome do projeto", () => {
      const xml = buildOne().to_niku();
      assert(/<!--[\s\S]*SyntaxMesh[\s\S]*-->/.test(xml,), xml.slice(0, 200,),);
    });
  });

  describe("to_html (14.20.1.3)", () => {
    it("monta tabela com cabeçalho e linha de totais", () => {
      const r = new Resource(project, "r1", "R1", null,);
      const p = makeNiku("P1", "Alpha",);
      resourceAllocation(p, "rid1", 5.0,);
      const niku = new TestNikuReport(report,);
      niku.seed([p,], [["rid1", r,],], [["rid1", 10.0,],], [],);
      const html = niku.to_html().toHTML();
      assert(html.includes("<table",),);
      assert(html.includes("tj_table",),);
      assert(html.includes("Project",),);
      assert(html.includes("Resource",),);
      assert(html.includes("Total",),);
      // Nome e ID do recurso aparecem na célula de linha.
      assert(html.includes("R1 (rid1)",),);
    });

    it("omite projeto com projectTotal <= 0", () => {
      const r = new Resource(project, "r1", "R1", null,);
      const p1 = makeNiku("P1", "Zero",);
      // sem alocações → projectTotal == 0
      const p2 = makeNiku("P2", "Some",);
      resourceAllocation(p2, "rid1", 3.0,);
      const niku = new TestNikuReport(report,);
      niku.seed([p1, p2,], [["rid1", r,],], [["rid1", 10.0,],], [],);
      const html = niku.to_html().toHTML();
      assert(html.includes("Some",),);
      assert(!html.includes(">Zero<",), "projeto zero omitido",);
      assert(html.includes("P2",),);
      assert(!html.includes(">P1<",),);
    });
  });

  describe("to_csv (14.20.1.3)", () => {
    it("produz header de nomes, header de IDs e uma linha por recurso", () => {
      const r1 = new Resource(project, "r1", "Alice", null,);
      const r2 = new Resource(project, "r2", "Bob", null,);
      const p = makeNiku("P1", "Alpha",);
      resourceAllocation(p, "rid1", 2.0,);
      resourceAllocation(p, "rid2", 7.0,);
      const niku = new TestNikuReport(report,);
      niku.seed(
        [p,],
        [["rid1", r1,], ["rid2", r2,],],
        [["rid1", 10.0,], ["rid2", 10.0,],],
        [],
      );
      const table = niku.to_csv();
      assertEquals(table.length, 4, "2 headers + 2 linhas de recurso",);
      assertEquals(table[0], ["", "Alpha",],);
      assertEquals(table[1], ["Resource", "P1",],);
      assertEquals(table[2]![0], "Alice (rid1)",);
      assertEquals(table[2]![1], 0.2,);
      assertEquals(table[3]![0], "Bob (rid2)",);
      assertEquals(table[3]![1], 0.7,);
    });
  });

  describe("computeResourceTotals (14.20.1.4)", () => {
    it("lança quando não há recursos com ClarityRID", () => {
      const niku = new NikuReport(report,);
      // Sem atributo ClarityRID definido → sempre lança.
      let threw = false;
      try {
        niku.generateIntermediateFormat();
      } catch (e) {
        threw = true;
        assert((e as Error).message.includes("ClarityRID",),);
      }
      assert(threw, "deve lançar por falta de ClarityRID",);
    });
  });

  describe("fábrica de conteúdo (14.20.1 wiring)", () => {
    it("'niku' está registrado na fábrica", () => {
      const factory = contentFactories.get("niku",);
      assert(factory,);
      const c = factory!(report,) as unknown as NikuReport;
      assert(c instanceof NikuReport,);
    });
  });
});
