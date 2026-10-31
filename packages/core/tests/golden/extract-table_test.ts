/**
 * 14.23 — Testes das unidades que sustentam o golden de relatórios:
 *   • normalização de texto de célula (14.23.9);
 *   • digest estrutural de tabela (14.23.8);
 *   • smoke: `Report.generate()` retorna string (14.23.12, ADR 026/027);
 *   • determinismo/regressão: dois runs do pipeline TS sobre o mesmo arquivo
 *     produzem o mesmo digest (14.23.11).
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { ProjectFileParser, } from "../../src/parser/mod.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TableReport, } from "../../src/reports/table-report.ts";
// Registra as fábricas de conteúdo de relatório (efeito colateral).
import "../../src/reports/mod.ts";
import { digestTable, extractTable, normText, } from "./extract-table.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";

const REPO_ROOT = new URL("../../../../", import.meta.url,);

describe("14.23 normText (normalização de texto de célula)", () => {
  it("colapsa runs de espaço/tab/newline em um único espaço", () => {
    assertEquals(normText("  a \t\n  b  ",), "a b",);
  });
  it("retorna null para vazio/whitespace-only/null", () => {
    assertEquals(normText(null,), null,);
    assertEquals(normText("",), null,);
    assertEquals(normText("   \n\t ",), null,);
  });
  it("usa to_s() de RichTextIntermediate quando presente", () => {
    const rti = { to_s: () => "  Foo  Bar ", };
    assertEquals(normText(rti as unknown,), "Foo Bar",);
  });
});

describe("14.23 digestTable (geometria da tabela intermediária)", () => {
  it("retorna null para tabela ausente", () => {
    assertEquals(digestTable(null,), null,);
    assertEquals(digestTable(undefined,), null,);
  });
  it("conta colunas e distingue célula de texto (~) de célula especial", () => {
    const table = {
      header: [["Name", null,], ["Start", null,], [null, "<calendario>",],],
      rows: [
        // [indent,bold], '~',text,indent,rows,cols,  '<calendario>',rows,cols
        [[0, null,], "~", "T", 0, null, null, "<calendario>", 2, null,],
      ],
    };
    const d = digestTable(table,);
    assertEquals(d?.columnCount, 3,);
    assertEquals(d?.rowCount, 1,);
    assertEquals(d?.rowKinds, [["~", "<calendario>",],],);
  });
  it("consome a aridade correta por kind (5 para '~', 3 para especial)", () => {
    const table = {
      header: [[null,],],
      rows: [[[1, 1,], "~", "a", 0, null, null, "~", "b", 0, null, null,],],
    };
    assertEquals(digestTable(table,)?.rowKinds, [["~", "~",],],);
  });
});

/** Roda o pipeline TS e devolve os digests por id (para smoke/determinismo). */
function digestsFor(rel: string,): Map<string, ReturnType<typeof digestTable>> {
  TjTime.setTimeZone("Europe/Berlin",);
  const mh = MessageHandlerInstance.instance;
  mh.messages.length = 0;
  mh.errors = 0;
  const parser = new ProjectFileParser();
  parser.open(new URL(rel, REPO_ROOT,).pathname, true, false,);
  const project = parser.parse("project",) as Project;
  project.schedule();
  const out = new Map<string, ReturnType<typeof digestTable>>();
  for (const report of project.reports.toArray() as Report[]) {
    const formats = report.get("formats",) as string[] | null;
    if (!formats?.length) continue;
    project.reportContexts.push(new ReportContext(project, report,),);
    try {
      report.generateIntermediateFormat();
      const content = report.content;
      if (content instanceof TableReport && content.getTable()) {
        out.set(
          report.fullId,
          digestTable(extractTable(content.getTable(),),),
        );
      }
    } finally {
      project.reportContexts.pop();
    }
  }
  return out;
}

describe("14.23 determinismo/regressão do pipeline de relatórios", () => {
  it("dois runs sobre mwe005 produzem digests idênticos", () => {
    const a = digestsFor("docs/Learning/mwe005/tutorial.tjp",);
    const b = digestsFor("docs/Learning/mwe005/tutorial.tjp",);
    assertEquals([...a.keys(),], [...b.keys(),], "mesmos relatórios",);
    for (const [id, digest,] of a) {
      assertEquals(b.get(id,), digest, `digest de ${id} não determinístico`,);
    }
    assert(a.size > 0, "mwe005 deveria produzir ao menos 1 tabela",);
  });
});

describe("14.23 smoke: Report.generate() retorna string (ADR 026/027)", () => {
  it("relatório html do mwe005 retorna uma string (sem escrever em disco)", () => {
    TjTime.setTimeZone("Europe/Berlin",);
    const mh = MessageHandlerInstance.instance;
    mh.messages.length = 0;
    mh.errors = 0;
    const parser = new ProjectFileParser();
    parser.open(
      new URL("docs/Learning/mwe005/tutorial.tjp", REPO_ROOT,).pathname,
      true,
      false,
    );
    const project = parser.parse("project",) as Project;
    project.schedule();
    const report = (project.reports.toArray() as Report[]).find((r,) => {
      const f = r.get("formats",) as string[] | null;
      return f?.includes("html",);
    },);
    assert(report, "mwe005 tem um relatório html",);
    project.reportContexts.push(new ReportContext(project, report,),);
    try {
      report.generate();
      const output = report.output;
      assertEquals(typeof output, "string",);
      assert(
        (output as string).includes("<table",),
        "saída html deveria conter a tabela",
      );
    } finally {
      project.reportContexts.pop();
    }
  });
});
