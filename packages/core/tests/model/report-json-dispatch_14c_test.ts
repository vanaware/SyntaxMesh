/**
 * 14C.0.1 + 14C.0.10 — `format json` de primeira classe e âncoras de dispatch
 * das extensões (materialreport / breakdownreport / rdoreport).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md
 */

import { afterEach, beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import {
  contentFactories,
  registerContentFactory,
  type ReportContent,
} from "../../src/model/report-content.ts";
import "../../src/reports/mod.ts";

/**
 * Fábricas registradas no carregamento do módulo — capturadas antes dos
 * `contentFactories.clear()` de cada teste. Os blocos 14C.1–14C.3 consumiram
 * todas as âncoras `NotYetImplementedError` de `EXTENSION_TYPE_BLOCKS`; o que
 * resta a verificar é que cada extensão resolve para a sua fábrica.
 */
const REGISTERED_AT_LOAD = new Set(contentFactories.keys(),);

/** Conteúdo falso com `toJSON` opcional. */
function fakeContent(overrides: Partial<ReportContent> = {},): ReportContent {
  return { generateIntermediateFormat() {}, ...overrides, } as ReportContent;
}

describe("Report generate json (14C.0.1)", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(2,);
    MessageHandlerInstance.instance.reset();
  },);

  afterEach(() => {
    contentFactories.clear();
  },);

  function newReport(name = "report1",): Report {
    const r = new Report(project, name, name, null,);
    r.set("timezone", "UTC",);
    return r;
  }

  it("formato json roteia para content.toJSON e grava string + .json", () => {
    registerContentFactory(
      "taskreport",
      () => fakeContent({ toJSON: () => '{"format":"table"}', },),
    );
    const r = newReport("rep",);
    r.typeSpec = "taskreport" as never;
    r.generate(["json",],);
    assert(r.outputFileName.endsWith("/rep.json",), r.outputFileName,);
    assertEquals(r.output, '{"format":"table"}',);
  });

  it("conteúdo sem toJSON emite warning json_not_supported", () => {
    registerContentFactory("taskreport", () => fakeContent(),);
    const r = newReport("r",);
    r.typeSpec = "taskreport" as never;
    r.generate(["json",],);
    const mh = MessageHandlerInstance.instance;
    assert(mh.messages.some((m,) => m.id === "json_not_supported"),);
  });

  it("formato desconhecido ainda lança", () => {
    registerContentFactory("taskreport", () => fakeContent(),);
    const r = newReport();
    r.typeSpec = "taskreport" as never;
    assertThrows(() => r.generate(["pdf",],), Error, "Unknown report output",);
  });
});

describe("Dispatch das extensões 14C (14C.0.10)", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(2,);
    MessageHandlerInstance.instance.reset();
  },);

  afterEach(() => {
    contentFactories.clear();
  },);

  it("enum cobre os três novos tipos", () => {
    assertEquals(ReportType.MaterialReport, "MaterialReport",);
    assertEquals(ReportType.BreakdownReport, "BreakdownReport",);
    assertEquals(ReportType.RdoReport, "RdoReport",);
  });

  for (
    const [type, block,] of [
      ["materialreport", "14C.1.4",],
      ["breakdownreport", "14C.2",],
      ["rdoreport", "14C.3",],
    ] as const
  ) {
    it(`${type} resolve para a fábrica registrada (${block})`, () => {
      assert(
        REGISTERED_AT_LOAD.has(type,),
        `${type} sem fábrica — âncora ${block} não consumida`,
      );
    });
  }

  it("typeSpec desconhecido continua lançando 'Unknown report type'", () => {
    const r = new Report(project, "x", "x", null,);
    r.set("timezone", "UTC",);
    r.typeSpec = "bogus" as never;
    assertThrows(() => r.generateIntermediateFormat(), Error, "Unknown",);
  });
});
