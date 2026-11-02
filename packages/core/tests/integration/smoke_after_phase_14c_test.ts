/**
 * 14C.7.5 — Smoke test pós-Fase 14 Complemento.
 *
 * Exercita o fluxo ponta-a-ponta dos quatro consumidores do complemento a
 * partir de um `.tjp` real (`fixtures/ext/14c-smoke.tjp`):
 *
 *  1. `materialreport` → HTML/CSV/JSON;
 *  2. `breakdownreport` → HTML/JSON com contribuintes de material;
 *  3. `rdoreport` → HTML com galeria de pictures + JSON;
 *  4. `export` MSPDI → XML com o material como `<Resource>`.
 *
 * ADR 027: toda saída é string/estrutura em memória. O teste aponta o
 * `outputDir` do projeto para um diretório temporário e confirma que ele
 * permanece **vazio** — qualquer escrita futura em disco quebra o smoke.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.7.5)
 * @see docs/syntaxmesh/decisoes/027-reports-browser.md
 */

import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { parseProject, } from "../parser/parse-helper.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import type { Project, } from "../../src/model/project.ts";
// Efeito colateral: registra as fábricas de conteúdo de relatório.
import "../../src/reports/mod.ts";

const FIXTURE = "14c-smoke";

/** Parse + schedule do fixture do complemento, apontando a saída p/ um tmpdir. */
function loadProject(): { project: Project; outputDir: string } {
  const text = Deno.readTextFileSync(
    new URL(`../fixtures/ext/${FIXTURE}.tjp`, import.meta.url,),
  );
  const out = parseProject(text,);
  assertEquals(
    out.threw,
    null,
    `parse lançou: ${out.threw?.message ?? ""}`,
  );
  assertEquals(
    out.messageIds,
    [],
    `msgs=${out.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)}`,
  );
  const project = out.result as Project;
  project.schedule();
  // Nenhum relatório pode gravar em disco: o diretório precisa seguir vazio.
  const outputDir = Deno.makeTempDirSync({ prefix: "tj14c-smoke-", },);
  project.set("outputDir", `${outputDir}/`,);
  project.outputDir = `${outputDir}/`;
  return { project, outputDir, };
}

/**
 * Gera `format` para o relatório `id` com o contexto ativo (como o agregador
 * da Fase 9 faz) e devolve o `output`. O contexto é sempre desempilhado.
 */
function generate(
  project: Project,
  id: string,
  format: string,
): string | unknown[][] {
  const report = project.report(id,) as Report;
  assert(report !== null, `relatório ${id} ausente no fixture`,);
  project.reportContexts.push(new ReportContext(project, report,),);
  try {
    report.generate([format,],);
  } finally {
    project.reportContexts.pop();
  }
  const output = report.output;
  assert(output !== null, `relatório ${id} não produziu saída ${format}`,);
  return output;
}

/** Confere o diretório de saída (ADR 027) e remove o tmpdir. */
function assertNoDiskWrites(outputDir: string,): void {
  try {
    assertEquals(
      [...Deno.readDirSync(outputDir,),],
      [],
      "ADR 027: relatórios devolvem strings — nada pode ser gravado",
    );
  } finally {
    Deno.removeSync(outputDir, { recursive: true, },);
  }
}

describe("Smoke test after Fase 14 Complemento (14C.7.5)", () => {
  it("materialreport → html, csv e json em memória", () => {
    const { project, outputDir, } = loadProject();
    try {
      const html = generate(project, "mr", "html",) as string;
      assert(html.includes("<table",), "materialreport html sem tabela",);
      // `Material#name` agora é o rótulo do cabeçalho (14C.1.14 resolvido), então
      // a coluna `Name` traz "Aço" (e não mais o id `aco`).
      assert(html.includes(">Aço<",), "materialreport html sem o material",);

      const csv = generate(project, "mr", "csv",) as unknown[][];
      assertEquals(csv[0], [
        "No.",
        "Name",
        "Unit",
        "Unit Price",
        "Total Cost",
      ],);
      // Dois materiais no fixture (`aco`, `cimento`) + a linha de cabeçalho.
      assertEquals(csv.length, 3,);
      assertEquals(csv.slice(1,).map((row,) => row[1]), ["Aço", "Cimento",],);

      const json = JSON.parse(generate(project, "mr", "json",) as string,) as {
        format: string;
        lines: Array<{ cells: Array<{ text: string }> }>;
      };
      assertEquals(json.format, "table",);
      assertEquals(json.lines.length, 2,);
    } finally {
      assertNoDiskWrites(outputDir,);
    }
  });

  it("breakdownreport → html e json com contribuintes de material", () => {
    const { project, outputDir, } = loadProject();
    try {
      const html = generate(project, "br", "html",) as string;
      assert(html.includes("<table",), "breakdown html sem tabela",);

      const json = JSON.parse(generate(project, "br", "json",) as string,) as {
        groupby: string;
        groups: Array<{
          id: string;
          totals: { materials: number };
          contributors: Array<{ id?: string; material?: string }>;
        }>;
      };
      assertEquals(json.groupby, "account",);
      // `aggregate materials` soma o custo derivado das alocações (14C.11.10):
      // 100 × 2,5 + 20 × 12 = 490 (o antigo `totalquantity` foi removido).
      const materialTotal = json.groups.reduce(
        (sum, group,) => sum + group.totals.materials,
        0,
      );
      assertEquals(materialTotal, 490,);
      assert(
        json.groups.some((group,) => group.contributors.length > 0),
        "breakdown sem contribuintes",
      );
    } finally {
      assertNoDiskWrites(outputDir,);
    }
  });

  it("rdoreport → html com galeria de pictures e json", () => {
    const { project, outputDir, } = loadProject();
    try {
      const html = generate(project, "rdo", "html",) as string;
      assert(html.includes("<table",), "rdo html sem tabela",);
      // `journalentry` da tarefa (2026-02-03) entra no período do RDO e traz
      // uma picture — a galeria usa a saída de `picturesToHtml` (14C.3).
      assert(html.includes("img/obra.png",), "rdo html sem a galeria",);

      const json = JSON.parse(generate(project, "rdo", "json",) as string,) as {
        groupby: string;
        groups: Array<{ entries?: Array<{ pictures?: string[] }> }>;
      };
      assertEquals(json.groupby, "date",);
      assert(json.groups.length > 0, "rdo sem grupos",);
    } finally {
      assertNoDiskWrites(outputDir,);
    }
  });

  it("export MSPDI → xml com o material como Resource", () => {
    const { project, outputDir, } = loadProject();
    try {
      const report = (project.reports.toArray() as Report[]).find((r,) =>
        r.name === "MS Project"
      );
      assert(report, "export 'MS Project' ausente no fixture",);
      let xml = "";
      project.reportContexts.push(new ReportContext(project, report,),);
      try {
        report.generate(["mspxml",],);
        xml = report.output as string;
      } finally {
        project.reportContexts.pop();
      }
      assert(xml.includes("<Resources>",), "MSPDI sem <Resources>",);
      assert(xml.includes("<Name>Aço</Name>",), "MSPDI sem o material aco",);
      assertEquals(
        (xml.match(/<Assignment>/g,) ?? []).length > 0,
        true,
        "MSPDI sem <Assignment>",
      );
    } finally {
      assertNoDiskWrites(outputDir,);
    }
  });
});
