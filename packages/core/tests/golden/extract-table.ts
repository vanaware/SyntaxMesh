/**
 * 14.23 — Extrator do formato intermediário (`ReportTable`) para os golden
 * tests de relatórios.
 *
 * Espelho 1:1 de `scripts/golden/reports-common.rb::ReportsGolden.extract_table`.
 * Os dois walkers (Ruby sobre o `@table` real e TS sobre `TableReport.getTable()`)
 * é que são comparados — nunca o markup HTML, que difere por design (ADR 027) e
 * depende de Fase 15/16 (Gantt) e da geometria de calendário.
 *
 * Serialização de uma linha:
 *   [ [indentation, bold?1:null], <célula>, <célula>, … ]
 * onde cada `<célula>` é:
 *   ['~', textoNormalizado, indent, rows!=1?rows:null, cols!=1?cols:null]
 * ou, para células especiais (Gantt/calendário/placeholder/chart):
 *   [kind, rows!=1?rows:null, cols!=1?cols:null]
 *
 * @see scripts/golden/reports-common.rb
 * @see packages/core/src/reports/report-table-cell.ts
 */
import type { ReportTable, } from "../../src/reports/report-table.ts";
import type { ReportTableLine, } from "../../src/reports/report-table-line.ts";
import {
  PlaceHolderCell,
  ReportTableCell,
  type SpecialCell,
} from "../../src/reports/report-table-cell.ts";
import { ColumnTable, } from "../../src/reports/column-table.ts";

/** Colunas de calendário (geometria não portada — comparadas só estruturalmente). */
const CALENDAR_ATTRS = [
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
];

/** Mesma normalização de texto do lado Ruby. */
export function normText(value: unknown,): string | null {
  if (value === null || value === undefined) return null;
  let s: string;
  if (typeof value === "string") {
    s = value;
  } else {
    const toS = (value as { to_s?: () => string }).to_s;
    s = typeof toS === "function" ? toS.call(value,) : String(value,);
  }
  s = s.replace(/[ \t\r\n]+/g, " ",).trim();
  return s.length === 0 ? null : s;
}

/** Nome canônico de uma célula `special`, igual ao do Ruby. */
function specialKind(special: SpecialCell,): string {
  if (special instanceof PlaceHolderCell) return "<placeholder>";
  if (special instanceof ColumnTable) return "<calendario>";
  const name = special.constructor?.name ?? "";
  if (name.includes("Gantt",)) return "<gantt>";
  return "<especial>";
}

/** attributeId da célula (via query), para detectar chart/calendário. */
function cellAttributeId(cell: ReportTableCell,): string | null {
  return cell.query?.attributeId ?? null;
}

type CellData = string[] | (string | number | null)[];

/** Célula → array serializável; `null` quando oculta. */
function cellData(cell: ReportTableCell,): CellData | null {
  if (cell.hidden) return null;

  const attrId = cellAttributeId(cell,);
  let kind: string;
  if (cell.special) {
    kind = specialKind(cell.special,);
  } else if (attrId === "chart") {
    kind = "<gantt>";
  } else if (CALENDAR_ATTRS.includes(attrId ?? "",)) {
    kind = "<calendario>";
  } else {
    kind = "~";
  }

  const rows = cell.rows === 1 ? null : cell.rows;
  const cols = cell.columns === 1 ? null : cell.columns;
  if (kind === "~") {
    return ["~", normText(cell.text,), cell.indent, rows, cols,];
  }
  return [kind, rows, cols,];
}

/** Verdadeiro se a linha é de cabeçalho (alguma célula headerCell). */
function isHeaderLine(line: ReportTableLine,): boolean {
  return line.cells.some(
    (c,) => c instanceof ReportTableCell && c.headerCell,
  );
}

export type ExtractedTable = { header: unknown[][]; rows: unknown[][] };

/** Extrai { header, rows } de uma ReportTable (formato intermediário). */
export function extractTable(table: ReportTable | null,): ExtractedTable {
  const header: unknown[][] = [];
  const rows: unknown[][] = [];
  if (!table) return { header, rows, };

  // Cabeçalho: vem das colunas (cell1 topo / cell2 base), não das linhas.
  for (const col of table.getColumns()) {
    const entry: unknown[] = [normText(col.cell1.text,),];
    if (col.cell1.rows === 2) entry.push(normText(col.cell2.text,),);
    if (col.cell1.special) entry.push(specialKind(col.cell1.special,),);
    header.push(entry,);
  }

  for (const line of table.getLines()) {
    if (isHeaderLine(line,)) continue;
    const lineCells: unknown[] = [];
    for (const cell of line.cells) {
      if (!(cell instanceof ReportTableCell)) continue;
      const d = cellData(cell,);
      if (d === null) continue;
      if (lineCells.length === 0) {
        lineCells.push([line.indentation, line.bold ? 1 : null,],);
      }
      lineCells.push(...d,);
    }
    // Linha sem nenhuma célula visível (só indentação) é descartada.
    if (lineCells.length <= 1) continue;

    rows.push(lineCells,);
  }
  return { header, rows, };
}

/**
 * Digest estrutural estável de uma tabela extraída — a unidade comparada entre
 * os dois motores. Ignora os VALORES das células (dependentes dos `query_*` da
 * Fase 11, do rótulo `name`, do fuso das datas e dos títulos i18n das colunas,
 * todos com integridade pendente) e fixa apenas a GEOMETRIA do relatório que é
 * de responsabilidade da Fase 14: número de colunas, número de linhas e a
 * sequência de "kinds" de célula por linha (texto `~` vs `<calendario>` /
 * `<gantt>` / `<placeholder>`).
 *
 * Uma linha tem a forma `[ [indentation, bold], ...células ]`, célula `~` com
 * aridade 5 e célula especial com aridade 3.
 */
export type TableDigest = {
  columnCount: number;
  rowCount: number;
  rowKinds: string[][];
};

export function digestTable(
  table: { header: unknown[]; rows: unknown[][] } | null | undefined,
): TableDigest | null {
  if (!table) return null;
  const rowKinds: string[][] = [];
  for (const row of table.rows) {
    const kinds: string[] = [];
    let i = 1; // pula o prefixo [indentation, bold]
    while (i < row.length) {
      const kind = row[i] as string;
      kinds.push(kind,);
      i += kind === "~" ? 5 : 3;
    }
    rowKinds.push(kinds,);
  }
  return {
    columnCount: (table.header as unknown[]).length,
    rowCount: rowKinds.length,
    rowKinds,
  };
}
