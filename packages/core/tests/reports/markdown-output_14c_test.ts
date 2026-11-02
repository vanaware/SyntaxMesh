/**
 * Saída Markdown dos relatórios (Fase 14 — adendo §10 / bloco 14C.8).
 *
 * Dois níveis:
 * - renderização pura (`reports/markdown.ts`): células escapadas, tabela de
 *   pipes com alinhamento numérico, seções e imagens;
 * - saída de relatório: `formats markdown` e os aliases `md<X>report` do
 *   parser produzem `.md` em `report.output` (ADR 027: string, zero disco).
 *
 * Extensão SyntaxMesh sem oracle Ruby.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §10
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.8)
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  markdownCell,
  markdownHeading,
  markdownImage,
  markdownSections,
  markdownTable,
} from "../../src/reports/markdown.ts";
import { parseProject, } from "../parser/parse-helper.ts";
// Registra as fábricas de conteúdo (`taskreport`, `materialreport`, ...).
import "../../src/reports/mod.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";

const FIXTURE = `
project md "Markdown" "1.0" 2026-01-01 - 2026-12-31

task t "Tarefa" {
  start 2026-01-05
  effort 2d
}

taskreport tr "tr.md" {
  formats markdown
  columns name, start, end
}

mdtaskreport mtr "mtr.md" {
  columns name
}
`;

/** Parse + schedule do fixture. Falha se o parse emitir mensagens. */
function load(): Project {
  const out = parseProject(FIXTURE,);
  assertEquals(out.threw, null, `parse lançou: ${out.threw?.message ?? ""}`,);
  assertEquals(out.messageIds, [], `mensagens: ${out.messageIds.join(", ",)}`,);
  const project = out.result as Project;
  project.schedule();
  return project;
}

/** Gera o relatório com os formatos da própria definição e devolve o texto. */
function generate(project: Project, id: string, formats?: string[],): string {
  const report = project.report(id,) as Report;
  assert(report !== null, `relatório ${id} ausente`,);
  project.reportContexts.push(new ReportContext(project, report,),);
  try {
    report.generate(formats,);
  } finally {
    project.reportContexts.pop();
  }
  const output = report.output;
  assert(typeof output === "string", `saída de ${id} não é string`,);
  return output;
}

/** Carrega o fixture do smoke 14C (materiais, breakdown, RDO e MSPDI). */
function loadSmoke(): Project {
  const text = Deno.readTextFileSync(
    new URL("../fixtures/ext/14c-smoke.tjp", import.meta.url,),
  );
  const out = parseProject(text,);
  assertEquals(out.threw, null, `parse lançou: ${out.threw?.message ?? ""}`,);
  assertEquals(out.messageIds, [], `mensagens: ${out.messageIds.join(", ",)}`,);
  const project = out.result as Project;
  project.schedule();
  return project;
}

describe("renderização markdown pura (14C.8)", () => {
  it("escapa pipe, barra invertida e quebra de linha", () => {
    assertEquals(markdownCell(null,), "",);
    assertEquals(markdownCell(42,), "42",);
    assertEquals(markdownCell("a|b",), "a\\|b",);
    assertEquals(markdownCell("a\\b",), "a\\\\b",);
    assertEquals(markdownCell("linha1\nlinha2",), "linha1<br>linha2",);
  });

  it("monta tabela de pipes com cabeçalho e separador", () => {
    const md = markdownTable(
      ["Name", "Total",],
      [["aco", 12,], ["cimento", 3,],],
    );
    assertEquals(
      md,
      [
        "| Name | Total |",
        "| --- | ---: |",
        "| aco | 12 |",
        "| cimento | 3 |",
      ].join("\n",),
    );
  });

  it("completa linhas curtas e ignora tabela vazia", () => {
    assertEquals(
      markdownTable(["A", "B", "C",], [["x",],],),
      [
        "| A | B | C |",
        "| --- | --- | --- |",
        "| x |  |  |",
      ].join("\n",),
    );
    assertEquals(markdownTable([], [],), "",);
  });

  it("une seções não vazias com uma linha em branco", () => {
    assertEquals(
      markdownSections(["# T", "", null, "corpo\n\n",],),
      "# T\n\ncorpo\n",
    );
    assertEquals(markdownSections([null, "",],), "",);
  });

  it("gera títulos e imagens markdown", () => {
    assertEquals(markdownHeading(2, "  Obra   X ",), "## Obra X\n",);
    assertEquals(markdownHeading(9, "x",), "###### x\n",);
    assertEquals(markdownImage("img/a b.png",), "![](img/a%20b.png)",);
    assertEquals(
      markdownImage("img/a.png", "obra", 'Foto "1"',),
      `![obra](img/a.png "Foto '1'")`,
    );
  });
});

describe("saída markdown do relatório (14C.8)", () => {
  it("formats markdown gera documento com título e tabela", () => {
    const project = load();
    const report = project.report("tr",) as Report;
    const md = generate(project, "tr",);
    assert(md.startsWith("# Markdown - tr.md\n\n",), md,);
    assert(md.includes("| Name | Start | End |",), md,);
    assert(md.includes("| --- | --- | --- |",), md,);
    // Cabeçalho + separador + a linha da tarefa (`<Error>` nas células ainda
    // não integradas é a divergência modelo↔relatório já rastreada).
    assertEquals(
      md.split("\n",).filter((line,) => line.startsWith("| ",)).length,
      3,
    );
    assertEquals(
      report.outputFileName.endsWith("/tr.md",),
      true,
      report.outputFileName,
    );
  });

  it("mdtaskreport preseta formats markdown", () => {
    const project = load();
    const report = project.report("mtr",) as Report;
    assertEquals(report.get("formats",), ["markdown",],);
    const md = generate(project, "mtr",);
    assert(md.startsWith("# Markdown - mtr.md",), md,);
    assert(md.includes("| Name |",), md,);
    assertEquals(
      report.outputFileName.endsWith("/mtr.md",),
      true,
      report.outputFileName,
    );
  });
});

describe("markdown nos conteúdos da 14C (14C.8)", () => {
  it("mdmaterialreport gera a lista de materiais em pipes", () => {
    const project = loadSmoke();
    const report = project.report("mdm",) as Report;
    assertEquals(report.get("formats",), ["markdown",],);
    const md = generate(project, "mdm",);
    assert(md.startsWith("# Smoke 14C - Materiais (Markdown)",), md,);
    assert(
      md.includes("| No. | Name | Unit | Unit Price | Total Cost |",),
      md,
    );
    assert(md.includes("| Aço |",), md,);
    assert(md.includes("| ---: |",), md,);
  });

  it("breakdownreport gera a tabela hierárquica", () => {
    const project = loadSmoke();
    const md = generate(project, "br", ["markdown",],);
    const tableLines = md.split("\n",).filter((line,) =>
      line.startsWith("| ",)
    );
    assert(tableLines.length >= 3, md,);
    // O agrupamento é por conta: `Materiais` com o total das alocações
    // (100 × 2,5 + 20 × 12 = 490; `totalquantity` foi removido na 14C.11.10).
    assert(md.includes("| Materiais | 490 |",), md,);
  });

  it("rdoreport gera blocos, imagens e tabelas em markdown puro", () => {
    const project = loadSmoke();
    const md = generate(project, "rdo", ["markdown",],);
    assert(md.startsWith("# Smoke 14C - Diário de Obra",), md,);
    assert(md.includes("## 2026-02-03",), md,);
    assert(md.includes("### Início da obra",), md,);
    assert(md.includes('![](img/obra.png "Vista do canteiro")',), md,);
    assert(md.includes("| ID | Name | Detail | Amount |",), md,);
    // Markdown puro: nenhuma tag HTML de relatório vaza para a saída.
    assert(!md.includes("<table",), md,);
    assert(!md.includes("<div",), md,);
  });
});
