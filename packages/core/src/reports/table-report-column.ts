/**
 * TableReportColumn (Fase 14.12) — dados computados de uma coluna de tabela.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/TableReportColumn.rb`.
 * Guarda as datas (talvez ajustadas) de cada coluna, indexadas por
 * `TableColumnDefinition` no `@columns` de `TableReport`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.12.1.2)
 */
import type { TjTime, } from "../time/tj-time.ts";

export class TableReportColumn {
  start: TjTime | null;
  end: TjTime | null;

  constructor(startDate: TjTime | null, endDate: TjTime | null,) {
    this.start = startDate;
    this.end = endDate;
  }
}
