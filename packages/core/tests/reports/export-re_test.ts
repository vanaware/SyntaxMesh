/**
 * Testes de ExportRE (Fase 14.18.1).
 *
 * Cobre a delegação de `to_tjp()` para `TjpExportRE` e `to_mspxml()` para
 * `MspXmlRE`, e o registro da fábrica de conteúdo sob `export` (14.11).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.18.1)
 */
import { afterEach, beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { ExportRE, } from "../../src/reports/export-re.ts";
import { TjpExportRE, } from "../../src/reports/tjp-export-re.ts";
import { MspXmlRE, } from "../../src/reports/msp-xml-re.ts";
import { contentFactories, } from "../../src/model/report-content.ts";

describe("ExportRE (14.18.1)", () => {
  let project: Project;
  let report: Report;

  beforeEach(() => {
    project = createTestProject(1,);
    report = new Report(project, "ex", "export.tji", null,);
    report.set("start", TjTime.fromString("2026-01-01",),);
    report.set("end", TjTime.fromString("2026-12-31",),);
    report.set("scenarios", [0,],);
    project.reportContexts.push(new ReportContext(project, report,),);
  },);

  describe("delegação (14.18.1.3/14.18.1.4)", () => {
    const restores: Array<() => void> = [];

    afterEach(() => {
      while (restores.length) restores.pop()!();
    },);

    function stub<T,>(
      proto: Record<string, unknown>,
      method: string,
      impl: (this: T,) => string,
    ): void {
      const original = proto[method];
      proto[method] = impl;
      restores.push(() => {
        proto[method] = original;
      },);
    }

    it("to_tjp delega para TjpExportRE com o mesmo report", () => {
      let seen: Report | null = null;
      stub<TjpExportRE>(
        TjpExportRE.prototype as unknown as Record<string, unknown>,
        "to_tjp",
        function (this: TjpExportRE,) {
          seen = this.report;
          return "TJP-OUT";
        },
      );
      const ex = new ExportRE(report,);
      assertEquals(ex.to_tjp(), "TJP-OUT",);
      assertEquals(seen, report, "TjpExportRE recebe o mesmo report",);
    });

    it("to_mspxml delega para MspXmlRE com o mesmo report", () => {
      let seen: Report | null = null;
      stub<MspXmlRE>(
        MspXmlRE.prototype as unknown as Record<string, unknown>,
        "to_mspxml",
        function (this: MspXmlRE,) {
          seen = this.report;
          return "MSP-OUT";
        },
      );
      const ex = new ExportRE(report,);
      assertEquals(ex.to_mspxml(), "MSP-OUT",);
      assertEquals(seen, report, "MspXmlRE recebe o mesmo report",);
    });
  });

  describe("fábrica de conteúdo (14.11)", () => {
    it("registra 'export' na fábrica", () => {
      const factory = contentFactories.get("export",);
      assert(factory, "fábrica 'export' registrada",);
      const created = factory!(report,) as ExportRE;
      assert(created instanceof ExportRE,);
    });
  });

  describe("generateIntermediateFormat (14.18.1.2)", () => {
    it("é um no-op que não lança", () => {
      const ex = new ExportRE(report,);
      ex.generateIntermediateFormat();
    });
  });
});
