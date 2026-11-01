/**
 * Snapshot determinístico das extensões de relatório do Fase 14 Complemento
 * (14C.0.12). Diferente dos goldens ruby, estas extensões **não têm oracle no
 * tj3** — a fonte de verdade é este snapshot TS, gerado por
 * `generate_extension_golden.ts` e comparado byte-a-byte pelo teste
 * `reports-extensions_golden_test.ts`.
 *
 * Regras de determinismo:
 *   • nada de timestamps/fusos no payload (datas viram `headline` fixo);
 *   • iterações sobre insertion-order (Maps do índice do Journal, arrays do
 *     parser) — estável para um mesmo fixture;
 *   • probes de render com entradas constantes.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md
 *      (14C.0.12)
 */
import { parseProject, } from "../parser/parse-helper.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { JournalEntry, } from "../../src/model/journal.ts";
import { Picture, } from "../../src/model/picture.ts";
import { Task, } from "../../src/model/task.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { ReportTable, } from "../../src/reports/report-table.ts";
import { ReportTableColumn, } from "../../src/reports/report-table-column.ts";
import { ReportTableLine, } from "../../src/reports/report-table-line.ts";
import { ReportTableCell, } from "../../src/reports/report-table-cell.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { TableReport, } from "../../src/reports/table-report.ts";
import { picturesToHtml, } from "../../src/reports/gallery.ts";
import { BreakdownReport, } from "../../src/reports/breakdown-report.ts";
import { RdoReport, } from "../../src/reports/rdo-report.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { AlertLevelDefinition, } from "../../src/model/alert-levels.ts";
import { MspXmlRE, } from "../../src/reports/msp-xml-re.ts";

const FIXTURE = "14c-rdo-budget";

function loadFixture(name: string,): string {
  return Deno.readTextFileSync(
    new URL(`../fixtures/ext/${name}.tjp`, import.meta.url,),
  );
}

/** Subclasse que injeta a tabela no snapshot (member protegido). */
class SnapshotTableReport extends TableReport {
  constructor(report: Report, table: ReportTable,) {
    super(report,);
    this.table = table;
  }
}

/** Snapshot do fixture base: entidades, diários indexados e relatórios. */
function snapshotFixture(project: Project,) {
  const index = (
    map: Map<object, JournalEntry[]>,
  ): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    for (const [entity, entries,] of map) {
      out[(entity as { id: string }).id] = entries.map((e,) => e.headline);
    }
    return out;
  };
  const j = project.journal;
  const reports = (project.reports.toArray() as Report[]).map((r,) => ({
    id: r.id,
    typeSpec: String(r.typeSpec,),
    formats: (r.get("formats",) as string[] | null) ?? [],
    groupby: (r.get("groupby",) as string | null) ?? null,
    maxpictures: (r.get("maxpictures",) as number | null) ?? null,
    journalMode: (r.get("journalMode",) as string | null) ?? null,
  }));
  return {
    entities: {
      tasks: (project.tasks.toArray() as Task[]).map((t,) => t.fullId),
      resources: (project.resources.toArray() as Array<{ id: string }>).map(
        (r,) => r.id,
      ),
      materials: (project.materials.toArray() as Array<{ id: string }>).map(
        (m,) => m.id,
      ),
      accounts: (project.accounts.toArray() as Array<{ id: string }>).map(
        (a,) => a.id,
      ),
    },
    alertLevels: (project.get("alertLevels",) as AlertLevelDefinition[]).map(
      (l,) => [l.id, l.name, l.color,],
    ),
    journal: {
      total: j.entries.length,
      byTask: index(j.entriesByTask,),
      byResource: index(j.entriesByResource,),
      byMaterial: index(j.entriesByMaterial,),
      byAccount: index(j.entriesByAccount,),
      entries: j.entries.map((e,) => ({
        headline: e.headline,
        alertLevel: e.alertLevel,
        format: e.format,
        property: e.property ? (e.property as { id: string }).id : null,
        pictures: e.pictures.map((p,) => p.path),
      })),
    },
    reports,
  };
}

/** Probes de render das fundações C0 (json/table, picture html, galeria). */
function snapshotProbes() {
  // 1) TableReport.toJSON com tabela fixa.
  const project = createTestProject(1,);
  const report = new Report(project, "snap", "snap.json", null,);
  project.reportContexts.push(new ReportContext(project, report,),);
  const table = new ReportTable();
  new ReportTableColumn(
    table,
    new TableColumnDefinition("name", undefined,),
    "Name",
  );
  new ReportTableColumn(table, null, "Cal",);
  const line = new ReportTableLine(
    table,
    new Task(project, "t1", "T1", null,),
    null,
  );
  const text = new ReportTableCell(line, null, "Alpha",);
  text.alignment = "left";
  const cal = new ReportTableCell(line, null, "",);
  cal.special = { to_html: () => null, to_csv: () => 0, };
  const tr = new SnapshotTableReport(report, table,);

  // 2) Picture.to_html nas variantes documentadas.
  const plain = new Picture("https://cdn.example.com/a.png",);
  const figured = new Picture("img/aca.png",);
  figured.caption = "Peça";
  figured.align = "center";
  figured.width = 300;

  // 3) Galeria com corte por maxpictures.
  const gallery = picturesToHtml(
    [plain, figured, new Picture("img/z.png",),],
    2,
  );

  return {
    tableToJson: tr.toJSON(),
    pictureHtml: [plain.to_html().toHTML(), figured.to_html().toHTML(),],
    galleryCapped: gallery,
  };
}

/** Monta o snapshot completo (ordem de chaves fixa = bytes estáveis). */
export function buildExtensionSnapshot() {
  const out = parseProject(loadFixture(FIXTURE,),);
  if (out.threw !== null || out.result === false) {
    throw new Error(
      `fixture ${FIXTURE} não carrega: ${
        out.threw?.message ?? "parse false"
      } ` +
        `(${out.messageIds.join(",",)})`,
    );
  }
  return {
    schema: "syntaxmesh-reports-extensions/v1",
    fixture: FIXTURE,
    fixture14c: snapshotFixture(out.result as Project,),
    probes: snapshotProbes(),
    breakdown: snapshotBreakdown(),
    rdo: snapshotRdo(),
    mspdi: snapshotMspdi(),
  };
}

/**
 * Snapshot do `BreakdownReport` (14C.2.9): relê o fixture para não contaminar
 * `project.reports`/`reportContexts` usados por `snapshotFixture`.
 */
function snapshotBreakdown() {
  const run = (groupby: string,) => {
    const out = parseProject(loadFixture(FIXTURE,),);
    if (out.threw !== null || out.result === false) {
      throw new Error(
        `fixture ${FIXTURE} não carrega: ${
          out.threw?.message ?? "parse false"
        } `,
      );
    }
    const project = out.result as Project;
    const report = new Report(
      project,
      `bd-${groupby}`,
      `bd-${groupby}.html`,
      null,
    );
    report.typeSpec = ReportType.BreakdownReport;
    report.set("groupby", groupby,);
    project.reportContexts.push(new ReportContext(project, report,),);
    const re = new BreakdownReport(report,);
    re.generateIntermediateFormat();
    return {
      groupby,
      groups: re.getGroups(),
      html: re.to_html().map((el,) => (el as { toHTML(): string }).toHTML()),
      csv: re.to_csv(),
      json: JSON.parse(re.toJSON(),) as unknown,
    };
  };
  return [run("account",), run("task",),];
}

/**
 * Snapshot do `RdoReport` (14C.3.13): usa o `rdoreport rdo` do próprio fixture
 * e, na segunda execução, troca para `groupby material` com o período do
 * projeto (a entrada do material `steel` é de janeiro, fora do RDO declarado).
 */
function snapshotRdo() {
  const run = (groupby: string,) => {
    const out = parseProject(loadFixture(FIXTURE,),);
    if (out.threw !== null || out.result === false) {
      throw new Error(
        `fixture ${FIXTURE} não carrega: ${
          out.threw?.message ?? "parse false"
        } `,
      );
    }
    const project = out.result as Project;
    const report = project.reports.get("rdo",) as Report;
    report.force("groupby", groupby,);
    if (groupby === "material") {
      report.force("start", TjTime.fromString("2026-01-01",),);
      report.force("end", TjTime.fromString("2026-12-31",),);
    }
    project.reportContexts.push(new ReportContext(project, report,),);
    const re = new RdoReport(report,);
    re.generateIntermediateFormat();
    return {
      groupby,
      groups: re.getGroups(),
      html: re.to_html().map((el,) => (el as { toHTML(): string }).toHTML()),
      json: JSON.parse(re.toJSON(),) as unknown,
    };
  };
  return [run("date",), run("material",),];
}

/**
 * Snapshot do MSPDI estendido (14C.4.15).
 *
 * Não há oracle Ruby para material/custo/`effortdone`/`vacation` (o
 * `MspXmlRE.rb` não os exporta), então o snapshot desta implementação é a
 * fonte de verdade. Guardamos apenas os blocos sem timestamp de geração —
 * `<Calendars>`, `<Tasks>`, `<Resources>` e `<Assignments>` — para manter o
 * arquivo determinístico e o diff legível.
 */
function snapshotMspdi() {
  const fixture = "14c-mspdi-ext";
  const out = parseProject(loadFixture(fixture,),);
  if (out.threw !== null || out.result === false) {
    throw new Error(
      `fixture ${fixture} não carrega: ${out.threw?.message ?? "parse false"}`,
    );
  }
  const project = out.result as Project;
  project.schedule();
  const report = (project.reports.toArray() as Report[]).find((r,) =>
    r.name === "MS Project"
  );
  if (!report) throw new Error(`relatório MS Project ausente em ${fixture}`,);
  project.reportContexts.push(new ReportContext(project, report,),);
  const xml = new MspXmlRE(report,).to_mspxml();
  const section = (tag: string,): string => {
    const match = new RegExp(`<${tag}>[\\s\\S]*</${tag}>`,).exec(xml,);
    if (!match) throw new Error(`bloco <${tag}> ausente no MSPDI gerado`,);
    return match[0];
  };
  return {
    fixture,
    calendars: section("Calendars",),
    tasks: section("Tasks",),
    resources: section("Resources",),
    assignments: section("Assignments",),
  };
}
