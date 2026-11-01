/**
 * 14C.1.2/14C.1.3 — parser e i18n de `materialreport` + `sortby`
 * (extensões SyntaxMesh do Fase 14 Complemento).
 *
 * `materialreport` é um agregador análogo a `resourcereport`: cabeçalho cria o
 * `Report` com `typeSpec = "materialreport"` e defaults de colunas/ordenação;
 * o corpo é o `reportBody` compartilhado (columns / formats / hide* / sortby).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  type ParseOutcome,
  parseProject,
  PROJECT_HEADER,
} from "./parse-helper.ts";
import { globalRegistry, } from "../../src/i18n/mod.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";

/** Colunas (ids) de um relatório. */
function colIds(r: Report,): string[] {
  const cols = (r.get("columns",) as unknown as Array<{ id: string }>) ?? [];
  return cols.map((c,) => c.id);
}

/** Report de um projeto parseado, com asserções de falha explícitas. */
function reportOf(out: ParseOutcome, id: string,): Report {
  assertEquals(
    out.threw,
    null,
    `parse lançou (${out.messageIds.join(",",)})`,
  );
  assert(
    out.result !== false,
    `parse falhou: ${out.messageIds.join(",",)}`,
  );
  const report = (out.result as Project).report(id,);
  assert(report !== null, `relatório ${id} não registrado`,);
  return report;
}

describe("14C.1.2 rule_materialReport", () => {
  it("cabeçalho simples parseia e registra o typeSpec materialreport", () => {
    const out = parseProject(
      PROJECT_HEADER + 'materialreport mr "Materiais" {\n}\n',
    );
    const rep = reportOf(out, "mr",);
    assertEquals(rep.id, "mr",);
    assertEquals(rep.name, "Materiais",);
    assertEquals(String(rep.typeSpec,), "materialreport",);
  });

  it("sem `columns` usa os defaults do MaterialListRE", () => {
    const out = parseProject(
      PROJECT_HEADER + 'materialreport mr "Materiais" {\n}\n',
    );
    const rep = reportOf(out, "mr",);
    assertEquals(colIds(rep,), [
      "no",
      "name",
      "unit",
      "unitprice",
      "totalcost",
    ],);
    assertEquals(rep.modified("hideTask",), true,);
    assertEquals(rep.modified("hideResource",), true,);
    assertEquals(rep.modified("sortTasks",), true,);
    assertEquals(rep.modified("sortResources",), true,);
  });

  it("aceita columns, formats html/csv/json, hidetask, hideresource e sortby", () => {
    const out = parseProject(
      PROJECT_HEADER +
        'materialreport mr "Materiais" {\n' +
        "  columns name, note\n" +
        "  formats html, csv, json\n" +
        "  hidetask isleaf()\n" +
        "  hideresource isleaf()\n" +
        "  sortby name.up, note\n" +
        "}\n",
    );
    assertEquals(
      out.messageIds,
      [],
      `msgs=${out.messageIds.join(",",)}: ${
        out.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)
      }`,
    );
    const rep = reportOf(out, "mr",);
    assertEquals(colIds(rep,), ["name", "note",],);
    assertEquals(rep.get("formats",), ["html", "csv", "json",],);
    assertEquals(rep.get("sortBy",), [["name", true, -1,], [
      "note",
      false,
      -1,
    ],],);
  });

  it("sortby com direção inválida registra erro de direção", () => {
    const out = parseProject(
      PROJECT_HEADER +
        'materialreport mr "Materiais" {\nsortby name.asce\n}\n',
    );
    assert(
      out.messageIds.includes("sort_direction",),
      `expected sort_direction in [${out.messageIds.join(",",)}]`,
    );
  });
});

describe("14C.1.3 i18n materialreport/sortby", () => {
  it("keywords canônicas resolvidas em pt-BR e es", () => {
    assertEquals(
      globalRegistry.resolve("materialreport", "en",),
      "materialreport",
    );
    assertEquals(
      globalRegistry.resolve("relatoriomaterial", "pt-BR",),
      "materialreport",
    );
    assertEquals(
      globalRegistry.resolve("infomaterial", "es",),
      "materialreport",
    );
    assertEquals(globalRegistry.resolve("ordenarpor", "pt-BR",), "sortby",);
    assertEquals(globalRegistry.resolve("ordenarpor", "es",), "sortby",);
  });

  it("pt-BR: relatoriomaterial + colunas/formatos/ordenarpor parseia", () => {
    const out = parseProject(
      'language "pt-BR"\n' +
        'projeto prj "Teste" "1.0" 2026-01-01 - 2026-12-31\n' +
        'relatoriomaterial mr "Materiais" {\n' +
        "  colunas name, nota\n" +
        "  formatos html, json\n" +
        "  ordenarpor name.up\n" +
        "}\n",
    );
    assertEquals(out.messageIds, [], `msgs=${out.messageIds.join(",",)}`,);
    const rep = reportOf(out, "mr",);
    assertEquals(String(rep.typeSpec,), "materialreport",);
    assertEquals(colIds(rep,), ["name", "note",],);
    assertEquals(rep.get("formats",), ["html", "json",],);
    assertEquals(rep.get("sortBy",), [["name", true, -1,],],);
  });

  it("es: infomaterial parseia com AST equivalente ao en", () => {
    const body = (header: string, kw: ReportKeywords,): string =>
      header +
      `${kw.materialreport} mr "Materiais" {\n` +
      `  ${kw.columns} name, ${kw.note}\n` +
      `  ${kw.formats} html, json\n` +
      `  ${kw.sortby} name.up\n` +
      "}\n";
    const en = reportOf(
      parseProject(
        body(
          PROJECT_HEADER,
          {
            materialreport: "materialreport",
            columns: "columns",
            note: "note",
            formats: "formats",
            sortby: "sortby",
          },
        ),
      ),
      "mr",
    );
    const es = reportOf(
      parseProject(
        body(
          'language "es"\nproyecto prj "Test" "1.0" 2026-01-01 - 2026-12-31\n',
          {
            materialreport: "infomaterial",
            columns: "columnas",
            note: "nota",
            formats: "formatos",
            sortby: "ordenarpor",
          },
        ),
      ),
      "mr",
    );
    assertEquals(es.id, en.id,);
    assertEquals(String(es.typeSpec,), "materialreport",);
    assertEquals(colIds(es,), colIds(en,),);
    assertEquals(es.get("formats",), en.get("formats",),);
    assertEquals(es.get("sortBy",), en.get("sortBy",),);
  });
});

interface ReportKeywords {
  materialreport: string;
  columns: string;
  note: string;
  formats: string;
  sortby: string;
}
