/**
 * 15.13 — Golden tests de Gantt (geometria vs tj3 real).
 *
 * `gantt.golden.json` é gerado por `scripts/golden/gantt-mwe001..009.rb` (só os
 * MWEs com coluna `chart`: 001, 002, 003, 004, 006, 008, 009) e
 * `scripts/golden/gantt-testsuite.rb` (corpus HTML-Reports) contra o
 * TaskJuggler Ruby real: parse → schedule → `generateIntermediateFormat` →
 * `GanttChart#to_html` (que dispara `completeChart`) → snapshot da geometria.
 *
 * O que é comparado aqui (o walker TS é `gantt-extract.ts`):
 *   • período/escala/largura/altura do chart e `viewWidth`/scrollbar;
 *   • cabeçalho: altura, `gridLines`, datas das células, linhas now/markdate;
 *   • cada linha do chart: `y`, altura, categoria e o conteúdo
 *     (barras, marcos, containers, load stacks) com `x`/`xEnd`/`y`;
 *   • setas de dependência (`depArrows` como polilinhas) e cabeças de seta.
 *
 * Posições em pixels usam tolerância de **1px** (`POSITION_TOLERANCE`); datas,
 * contagens, strings e booleanos são exatos. O relógio é fixo
 * (`GanttGolden::FROZEN_NOW`, reaplicado aqui em `report['now']`) porque
 * `header.nowLineX` deriva de `now` e o do relatório nasce alinhado à hora.
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.13)
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { ProjectFileParser, } from "../../src/parser/mod.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TableReport, } from "../../src/reports/table-report.ts";
// Efeito colateral: registra as fábricas de conteúdo (TaskListRE, ...).
import "../../src/reports/mod.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";
import {
  type ChartSnapshot,
  chartSnapshotsOf,
  diffSnapshot,
  POSITION_TOLERANCE,
} from "./gantt-extract.ts";

interface GoldenCase {
  file: string;
  tz: string;
  /** Relógio fixo do oracle (`GanttGolden::FROZEN_NOW`). */
  now: string;
  error: string | null;
  chartErrors: Array<{ report: string; error: string }>;
  charts: ChartSnapshot[];
}

/** Raiz do repo a partir de packages/core/tests/golden/. */
const REPO_ROOT = new URL("../../../../", import.meta.url,);

function loadGolden(): GoldenCase[] {
  const content = Deno.readTextFileSync(
    new URL("./gantt.golden.json", import.meta.url,),
  );
  return (JSON.parse(content,) as { cases: GoldenCase[] }).cases;
}

/** Resultado TS de um arquivo: charts por `report:column` (ou erro). */
interface TsFileOutcome {
  charts: Map<string, ChartSnapshot>;
  fatal?: string;
}

/**
 * Re-executa o pipeline TS sobre o mesmo `.tjp` e devolve os snapshots das
 * colunas `chart`, indexados por `reportId:column` como no golden.
 */
function runTsFile(gc: GoldenCase,): TsFileOutcome {
  const charts = new Map<string, ChartSnapshot>();
  TjTime.setTimeZone(gc.tz,);
  const mh = MessageHandlerInstance.instance;
  mh.messages.length = 0;
  mh.errors = 0;

  let project: Project;
  try {
    const parser = new ProjectFileParser();
    parser.open(new URL(gc.file, REPO_ROOT,).pathname, true, false,);
    const result = parser.parse("project",) as Project | false;
    if (!result) return { charts, fatal: "parse-failed", };
    project = result;
    project.schedule();
  } catch (e) {
    const err = e as Error;
    return {
      charts,
      fatal: `${err.constructor.name}: ${
        err.message.split("\n",)[0] ?? err.message
      }`,
    };
  }

  for (const report of project.reports.toArray() as Report[]) {
    const formats = report.get("formats",) as string[] | null;
    if (!formats || formats.length === 0) continue;
    // `header.nowLineX` é `dateToX(now)` e o `now` do relatório nasce como
    // `TjTime.now().align(3600)` (Project.rb) — sem o pino o golden muda a
    // cada hora. O oracle Ruby aplica o mesmo valor (`FROZEN_NOW`).
    report.set("now", TjTime.fromString(gc.now,),);
    project.reportContexts.push(new ReportContext(project, report,),);
    try {
      report.generateIntermediateFormat();
      const content = report.content;
      if (content instanceof TableReport && content.getTable()) {
        for (
          const snap of chartSnapshotsOf(report.fullId, content.getTable()!,)
        ) {
          charts.set(`${snap.report}:${snap.column}`, snap,);
        }
      }
    } catch (e) {
      // Um relatório que o TS não monta não invalida os demais; o chart
      // esperado dele vai faltar no mapa e o teste do caso acusa.
      const err = e as Error;
      charts.set(
        `${report.fullId}:error`,
        {
          report: report.fullId,
          column: -1,
          scale: `${err.constructor.name}: ${err.message.split("\n",)[0]}`,
          startDate: 0,
          endDate: 0,
          width: 0,
          height: 0,
          viewWidth: null,
          scrollbar: false,
          header: {
            height: 0,
            nowLineX: null,
            markdateLineX: null,
            gridLines: [],
            cellStartDates: [],
          },
          lines: [],
          depArrows: [],
          arrowHeads: [],
        },
      );
    } finally {
      project.reportContexts.pop();
    }
  }
  return { charts, };
}

/** Cache por arquivo: parse+schedule é caro e roda uma única vez. */
const fileCache = new Map<string, TsFileOutcome>();
function evaluateFile(gc: GoldenCase,): TsFileOutcome {
  let cached = fileCache.get(gc.file,);
  if (!cached) {
    cached = runTsFile(gc,);
    fileCache.set(gc.file, cached,);
  }
  return cached;
}

const golden = loadGolden();
const totalCharts = golden.reduce((n, c,) => n + c.charts.length, 0,);
const totalLines = golden.reduce(
  (n, c,) => n + c.charts.reduce((m, ch,) => m + (ch.lines?.length ?? 0), 0,),
  0,
);
const totalArrows = golden.reduce(
  (n, c,) =>
    n + c.charts.reduce((m, ch,) => m + (ch.depArrows?.length ?? 0), 0,),
  0,
);

/** Formata no máximo `limit` divergências (o resto vira reticências). */
function report(diffs: string[], limit = 20,): string {
  const head = diffs.slice(0, limit,);
  const rest = diffs.length > limit ? `\n… +${diffs.length - limit}` : "";
  return head.join("\n",) + rest;
}

describe("15.13 golden: Gantt (geometria vs tj3 real)", () => {
  for (const goldenCase of golden) {
    describe(goldenCase.file, () => {
      if (goldenCase.error) {
        it(`[${goldenCase.file}] pulado: tj3 '${goldenCase.error}'`, () => {
          // O próprio oracle Ruby falhou neste arquivo: nada a comparar.
        });
        return;
      }
      // Relatórios em que o *Ruby* quebra ao montar a coluna `chart` (não o
      // walker): sem geometria do lado esperado, não há o que comparar. O
      // motivo fica registrado no nome do teste para não sumir em silêncio.
      for (const failed of goldenCase.chartErrors ?? []) {
        it(`[${failed.report}] pulado: tj3 '${failed.error}'`, () => {});
      }
      for (const expected of goldenCase.charts) {
        const label =
          `${expected.report} · coluna ${expected.column} (${expected.scale})`;
        it(label, () => {
          const outcome = evaluateFile(goldenCase,);
          assert(
            !outcome.fatal,
            `pipeline TS falhou em ${goldenCase.file}: ${outcome.fatal}`,
          );
          const actual = outcome.charts.get(
            `${expected.report}:${expected.column}`,
          );
          assert(
            actual,
            `coluna chart ausente: ${expected.report}:${expected.column}`,
          );
          const diffs = diffSnapshot(expected, actual, "",);
          assertEquals(
            diffs.length,
            0,
            `${label}\n${report(diffs,)}`,
          );
        },);
      }
    },);
  }

  it("cobertura: ≥ 30 unidades de comparação (charts + linhas + setas)", () => {
    const units = totalCharts + totalLines + totalArrows;
    assert(
      units >= 30,
      `golden com ${units} unidades (${totalCharts} charts, ` +
        `${totalLines} linhas, ${totalArrows} setas)`,
    );
    // Os 7 MWEs com `chart` precisam estar representados.
    for (const n of ["001", "002", "003", "004", "006", "008", "009",]) {
      const file = `docs/Learning/mwe${n}/tutorial.tjp`;
      assert(
        golden.some((c,) => c.file === file),
        `caso ausente no golden: ${file}`,
      );
    }
  });

  describe("comparador com tolerância de 1px", () => {
    it("aceita desvio de exatamente 1px", () => {
      assertEquals(
        diffSnapshot({ x: 10, y: 10, }, { x: 11, y: 9, }, "",),
        [],
      );
    });

    it("rejeita desvio ≥ 2px em posição", () => {
      assertEquals(
        diffSnapshot({ x: 10, }, { x: 12, }, "",).length,
        1,
      );
    });

    it("datas (chaves *Date) nunca são toleradas", () => {
      const diffs = diffSnapshot(
        { startDate: 1715907600, header: { cellStartDates: [1, 2,], }, },
        { startDate: 1715907601, header: { cellStartDates: [1, 3,], }, },
        "",
      );
      assertEquals(diffs, [
        "startDate: esperado 1715907600, veio 1715907601",
        "header.cellStartDates[1]: esperado 2, veio 3",
      ],);
    });

    it("acentua o path de listas e objetos aninhados", () => {
      const diffs = diffSnapshot(
        { lines: [{ content: [{ kind: "taskbar", x: 0, },], },], },
        { lines: [{ content: [{ kind: "milestone", x: 0, },], },], },
        "",
      );
      assertEquals(diffs, [
        'lines[0].content[0].kind: esperado "taskbar", veio "milestone"',
      ],);
    });
  });

  it(`tolerância exportada é ${POSITION_TOLERANCE}px`, () => {
    assertEquals(POSITION_TOLERANCE, 1,);
  });
});
