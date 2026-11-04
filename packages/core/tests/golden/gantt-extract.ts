/**
 * 15.13 — Extrator e comparador do golden de Gantt.
 *
 * Espelha `scripts/golden/gantt-common.rb`: a partir da `ReportTable` já gerada
 * (formato intermediário), localiza as colunas `chart`, completa cada
 * `GanttChart` (`to_html` dispara `completeChart`) e serializa a geometria no
 * mesmo schema do JSON gerado pelo Ruby.
 *
 * Os campos `private`/`height` das classes do Gantt são lidos por cast: em
 * TypeScript o modificador `private` só existe em tempo de compilação, e a
 * alternativa (expor getters públicos de snapshot) seria API de produção
 * criada só para o teste. Do lado Ruby o walker faz o equivalente com
 * `instance_variable_get`.
 */

import { GanttChart, } from "../../src/gantt/gantt-chart.ts";
import { GanttContainer, } from "../../src/gantt/gantt-container.ts";
import { GanttLine, } from "../../src/gantt/gantt-line.ts";
import { GanttLoadStack, } from "../../src/gantt/gantt-load-stack.ts";
import { GanttMilestone, } from "../../src/gantt/gantt-milestone.ts";
import { GanttTaskBar, } from "../../src/gantt/gantt-task-bar.ts";
import type { ReportTable, } from "../../src/reports/report-table.ts";
import { ReportTableColumn, } from "../../src/reports/report-table-column.ts";

/** Elemento de conteúdo (`GanttTaskBar`, `GanttMilestone`, ...). */
export type ContentSnapshot = {
  kind: string;
  x?: number;
  xEnd?: number;
  y?: number;
  w?: number;
  yLevels?: number[] | null;
  drawFrame?: boolean;
};

/** Uma linha do chart: posição, cor e conteúdo. */
export type LineSnapshot = {
  y: number;
  height: number;
  category: string | null;
  content: ContentSnapshot[];
};

/** Geometria completa de uma coluna `chart`. */
export type ChartSnapshot = {
  report: string;
  column: number;
  scale: string;
  startDate: number;
  endDate: number;
  width: number;
  height: number;
  viewWidth: number | null;
  scrollbar: boolean;
  header: {
    height: number;
    nowLineX: number | null;
    markdateLineX: number | null;
    gridLines: number[];
    cellStartDates: number[];
  };
  lines: LineSnapshot[];
  depArrows: number[][][];
  arrowHeads: number[][];
};

/** Campos internos do chart que o snapshot lê (o Ruby lê os mesmos ivars). */
interface ChartInternals {
  height: number;
  lines: GanttLine[];
  depArrows: Array<Array<[number, number,]>>;
  arrowHeads: Array<[number, number,]>;
}

/** Campos internos de uma linha. */
interface LineInternals {
  content: unknown[];
  category: string | null;
}

/** Campos internos de cada tipo de conteúdo. */
interface TaskBarInternals {
  start: number;
  end: number;
  y: number;
}
interface MilestoneInternals {
  x: number;
  y: number;
}
interface ContainerInternals {
  start: number;
  end: number;
  y: number;
}
interface LoadStackInternals {
  x: number;
  y: number;
  w: number;
  yLevels: number[] | null;
  drawFrame: boolean;
}

/** Serializa um elemento de conteúdo, na ordem dos `case` do Ruby. */
function contentSnapshot(content: unknown,): ContentSnapshot {
  if (content instanceof GanttTaskBar) {
    const c = content as unknown as TaskBarInternals;
    return { kind: "taskbar", x: c.start, xEnd: c.end, y: c.y, };
  }
  if (content instanceof GanttMilestone) {
    const c = content as unknown as MilestoneInternals;
    return { kind: "milestone", x: c.x, y: c.y, };
  }
  if (content instanceof GanttContainer) {
    const c = content as unknown as ContainerInternals;
    return { kind: "container", x: c.start, xEnd: c.end, y: c.y, };
  }
  if (content instanceof GanttLoadStack) {
    const c = content as unknown as LoadStackInternals;
    return {
      kind: "loadstack",
      x: c.x,
      y: c.y,
      w: c.w,
      yLevels: c.yLevels,
      drawFrame: c.drawFrame,
    };
  }
  // Tipo de conteúdo novo: o Ruby devolve o nome da classe sem `::`.
  return { kind: content?.constructor?.name ?? "unknown", };
}

/** Snapshot de uma `GanttLine`. */
function lineSnapshot(line: GanttLine,): LineSnapshot {
  const internals = line as unknown as LineInternals;
  return {
    y: line.y,
    height: line.height,
    category: internals.category,
    content: internals.content.map(contentSnapshot,),
  };
}

/**
 * Segundos inteiros de uma data, como `TjTime#to_i` do Ruby (`localtime.to_i`
 * trunca a fração). A margem de `adjustColumnPeriod` tem .5s em alguns casos,
 * então os `TjTime` do chart podem carregar fração — o golden registra o
 * truncamento.
 */
function dateSeconds(t: { toSeconds(): number },): number {
  return Math.trunc(t.toSeconds(),);
}

/** Snapshot de um `GanttChart` já completo. */
export function chartSnapshot(
  reportId: string,
  column: number,
  chart: GanttChart,
): ChartSnapshot {
  // Dispara `completeChart`: router, depArrows e arrowHeads. No Ruby o mesmo
  // acontece dentro de `to_html`.
  chart.to_html();
  const header = chart.header;
  if (!header) throw new Error("chart sem header depois de to_html",);
  const internals = chart as unknown as ChartInternals;
  if (chart.start === null || chart.end === null || chart.scale === null) {
    throw new Error("chart não gerado",);
  }
  return {
    report: reportId,
    column,
    scale: chart.scale.name,
    startDate: dateSeconds(chart.start,),
    endDate: dateSeconds(chart.end,),
    width: chart.width,
    height: internals.height,
    viewWidth: chart.viewWidth,
    scrollbar: chart.hasScrollbar(),
    header: {
      height: header.height,
      nowLineX: header.nowLineX,
      markdateLineX: header.markdateLineX,
      gridLines: [...header.gridLines,],
      cellStartDates: header.cellStartDates.map(dateSeconds,),
    },
    lines: internals.lines.map(lineSnapshot,),
    depArrows: internals.depArrows.map((arrow,) =>
      arrow.map(([x, y,],) => [x, y,])
    ),
    arrowHeads: internals.arrowHeads.map(([x, y,],) => [x, y,]),
  };
}

/** Todas as colunas `chart` de uma `ReportTable`, na ordem do Ruby. */
export function chartSnapshotsOf(
  reportId: string,
  table: ReportTable,
): ChartSnapshot[] {
  const out: ChartSnapshot[] = [];
  const columns = table.getColumns() as ReportTableColumn[];
  columns.forEach((col, idx,) => {
    const special = col.cell1.special;
    if (special instanceof GanttChart) {
      out.push(chartSnapshot(reportId, idx, special,),);
    }
  },);
  return out;
}

/** Tolerância (em pixels) aceita nas comparações numéricas. */
export const POSITION_TOLERANCE = 1;

/**
 * Chaves cujos números são datas (segundos desde a época), não pixels:
 * comparadas sempre exatamente.
 *
 * O path pode vir com índice de lista (`header.cellStartDates[3]`), então o
 * sufixo `[n]` é removido antes do teste — do contrário um item de série de
 * datas seria tolerado como se fosse uma posição em pixels.
 */
function isDateKey(path: string,): boolean {
  const key = path.replace(/\[\d+\]$/, "",).split(".",).pop() ?? "";
  return /Dates?$/.test(key,);
}

/**
 * Coleta as divergências entre o snapshot esperado (golden Ruby) e o obtido
 * (TS). Números de posição aceitam `POSITION_TOLERANCE` px; datas, strings,
 * booleanos e tamanhos de array são exatos.
 */
export function diffSnapshot(
  expected: unknown,
  actual: unknown,
  path: string,
  out: string[] = [],
): string[] {
  if (expected === null || expected === undefined) {
    if (actual !== null && actual !== undefined) {
      out.push(
        `${path}: esperado ${JSON.stringify(expected,)}, veio ${
          JSON.stringify(actual,)
        }`,
      );
    }
    return out;
  }
  if (typeof expected === "number") {
    if (typeof actual !== "number") {
      out.push(
        `${path}: esperado número ${expected}, veio ${JSON.stringify(actual,)}`,
      );
      return out;
    }
    if (expected !== actual) {
      const delta = Math.abs(expected - actual,);
      if (isDateKey(path,) || delta > POSITION_TOLERANCE) {
        out.push(`${path}: esperado ${expected}, veio ${actual}`,);
      }
    }
    return out;
  }
  if (typeof expected === "boolean" || typeof expected === "string") {
    if (expected !== actual) {
      out.push(
        `${path}: esperado ${JSON.stringify(expected,)}, veio ${
          JSON.stringify(actual,)
        }`,
      );
    }
    return out;
  }
  if (Array.isArray(expected,)) {
    if (!Array.isArray(actual,)) {
      out.push(`${path}: esperado array, veio ${JSON.stringify(actual,)}`,);
      return out;
    }
    if (expected.length !== actual.length) {
      out.push(
        `${path}.length: esperado ${expected.length}, veio ${actual.length}`,
      );
    }
    const n = Math.min(expected.length, actual.length,);
    for (let i = 0; i < n; i++) {
      diffSnapshot(expected[i], actual[i], `${path}[${i}]`, out,);
    }
    return out;
  }
  // Objeto: todas as chaves esperadas precisam existir e conferir.
  const exp = expected as Record<string, unknown>;
  const act = (actual ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(exp,)) {
    diffSnapshot(exp[key], act[key], path ? `${path}.${key}` : key, out,);
  }
  return out;
}
