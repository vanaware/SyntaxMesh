/**
 * TraceReport (Fase 14.20.2) — instantâneo periódico de atributos em CSV.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/TraceReport.rb`.
 * A cada execução monta um cabeçalho `[Date, ...colunas de contas/recursos/
 * tarefas]`, reaproveita a tabela anterior (reordenando colunas via
 * `TableColumnSorter` se os cabeçalhos mudaram) e acrescenta/atualiza a linha
 * correspondente à data atual (`project['now'].midnight()`).
 *
 * ⚠️ Browser (ADR 027): a variante Ruby lê o CSV anterior do disco via
 * `File.exist?(@fileName) && CSVFile.new(...).read(...)`. Aqui não tocamos no
 * filesystem; a tabela anterior é injetada por `previousTableSource` (default
 * `null` → primeira execução). O chamador (UI/Fase 19 — Storage) é o
 * responsável por persistir/carregar o CSV entre execuções.
 *
 * `to_html()` renderiza o gráfico SVG via `ChartPlotter` (Fase 14.22); erros de
 * dados do gráfico viram aviso, fiel ao `rescue ChartPlotterError` do Ruby.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.20.2)
 */

import type { Report, } from "../model/report.ts";
import type { Account, } from "../model/account.ts";
import type { Resource, } from "../model/resource.ts";
import type { Task, } from "../model/task.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import { PropertyList, } from "../model/property-list.ts";
import { Query, } from "../query/query.ts";
import { SimpleQueryExpander, } from "../query/simple-query-expander.ts";
import { TjTime, } from "../time/tj-time.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import type { LogicalExpression, } from "../logic/logical-expression.ts";
import { TableColumnDefinition, } from "./table-column-definition.ts";
import { TableColumnSorter, } from "./table-column-sorter.ts";
import { ReportBase, } from "./report-base.ts";
import type { OpenNodes, } from "./report-base.ts";
import { ChartPlotter, ChartPlotterError, } from "../chart-plotter.ts";
import { createBlob, type XMLElementLike, } from "../richtext/xml-like.ts";
import { registerContentFactory, } from "../model/report-content.ts";

/** Data em formato ISO curto (`YYYY-MM-DD`) usada para round-trip do CSV. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Snapshot de tabela carregado de uma execução anterior. Cada linha é um array
 * de células; a primeira linha contém os cabeçalhos. Células podem ser
 * `string` (formato cru do CSV) — o relatório as converterá para `TjTime`/`null`
 * durante `generateIntermediateFormat`.
 */
export type TraceTable = unknown[][];

export class TraceReport extends ReportBase {
  /** Tabela intermediária (cabeçalho + uma linha por data rastreada). */
  private table: TraceTable | null = null;
  /**
   * Fonte opcional da tabela anterior (equivalente ao CSV em disco do Ruby).
   * Retorna `null` quando não há histórico — primeira execução.
   */
  previousTableSource: (() => TraceTable | null) | null = null;

  constructor(report: Report,) {
    super(report,);
  }

  /** Tabela após `generateIntermediateFormat` (para inspeção/testes). */
  getTable(): TraceTable | null {
    return this.table;
  }

  /** Monta a tabela intermediária: cabeçalhos + merge do histórico + linha atual. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();

    // Query compartilhada por todas as células (carga/formatos/journal/contas).
    const queryAttrs = {
      project: this.project,
      scopeProperty: null,
      loadUnit: this.a("loadUnit",) as string | null,
      numberFormat: this.a("numberFormat",) as never,
      // TraceReport sempre usa %Y-%m-%d hard-coded para datas.
      timeFormat: "%Y-%m-%d",
      currencyFormat: this.a("currencyFormat",) as never,
      start: this.a("start",) as TjTime,
      end: this.a("end",) as TjTime,
      hideJournalEntry: this.a("hideJournalEntry",),
      journalMode: this.a("journalMode",) as string | null,
      journalAttributes: this.a("journalAttributes",) as string[] | null,
      sortJournalEntries: this.a("sortJournalEntries",),
      costAccount: this.a("costaccount",) as string | null,
      revenueAccount: this.a("revenueaccount",) as string | null,
    };
    const query = new Query(queryAttrs,);

    // Lista de contas ordenada e filtrada.
    let accountList = new PropertyList<Account>(this.project.accounts,);
    accountList.setSorting(
      (this.a("sortAccounts",) as Array<[string, boolean, number,]>) ?? [],
    );
    accountList.query = query;
    accountList = this.filterAccountList(
      accountList,
      this.a("hideAccount",) as LogicalExpression | null,
      this.a("rollupAccount",) as LogicalExpression | null,
      this.a("openNodes",) as OpenNodes | null,
    );
    accountList.sort();

    // Lista de recursos (a variante Ruby usa `filterTaskList` por engano;
    // usamos `filterResourceList` — semanticamente equivalente e correto).
    let resourceList = new PropertyList<Resource>(this.project.resources,);
    resourceList.setSorting(
      (this.a("sortResources",) as Array<[string, boolean, number,]>) ?? [],
    );
    resourceList.query = query;
    resourceList = this.filterResourceList(
      resourceList,
      null,
      this.a("hideResource",) as LogicalExpression | null,
      this.a("rollupResource",) as LogicalExpression | null,
      this.a("openNodes",) as OpenNodes | null,
    );
    resourceList.sort();

    // Lista de tarefas inclui adotadas e é filtrada como em TaskListRE.
    let taskList = new PropertyList<Task>(this.project.tasks,);
    taskList.includeAdopted();
    taskList.setSorting(
      (this.a("sortTasks",) as Array<[string, boolean, number,]>) ?? [],
    );
    taskList.query = query;
    taskList = this.filterTaskList(
      taskList,
      null,
      this.a("hideTask",) as LogicalExpression | null,
      this.a("rollupTask",) as LogicalExpression | null,
      this.a("openNodes",) as OpenNodes | null,
    );
    taskList.sort();

    // Cabeçalho: coluna Date + colunas de contas/recursos/tarefas.
    const headers: string[] = [
      "Date",
      ...this.generatePropertyListHeader(accountList, query,),
      ...this.generatePropertyListHeader(resourceList, query,),
      ...this.generatePropertyListHeader(taskList, query,),
    ];

    let discontinuedColumns = 0;
    const previous = this.previousTableSource ?
      this.previousTableSource() :
      null;
    if (previous && previous.length > 0) {
      this.table = previous;
      const oldHeaders = this.table[0] as unknown[];
      if (!headersEqual(oldHeaders, headers,)) {
        // Colunas mudaram: reordena e move as descontinuadas para o fim.
        const sorter = new TableColumnSorter(this.table,);
        this.table = sorter.sort(headers,);
        discontinuedColumns = sorter.discontinuedColumns ?? 0;
      }
    } else {
      this.table = [[...headers,],];
    }

    // Normaliza células do histórico: "" → null; `YYYY-MM-DD` → TjTime.
    for (const line of this.table) {
      for (let i = 0; i < line.length; i++) {
        const cell = line[i];
        if (cell === "") {
          line[i] = null;
        } else if (typeof cell === "string" && DATE_RE.test(cell,)) {
          line[i] = TjTime.fromString(cell,);
        }
      }
    }

    // Linha da data atual — substitui se já existir, adiciona caso contrário.
    const ctxQuery = this.currentQuery().dup();
    const dateTag = (this.project.get("now",) as TjTime).midnight();

    let idx = this.table.findIndex(
      (line,) =>
        line[0] instanceof TjTime &&
        (line[0] as TjTime).equals(dateTag,),
    );
    let discColumnValues: unknown[] = discontinuedColumns > 0
      ? new Array(discontinuedColumns,).fill(null,)
      : [];

    if (idx >= 0) {
      // Data já rastreada: preserva valores antigos das colunas descontinuadas.
      if (discontinuedColumns > 0) {
        discColumnValues = (this.table[idx] as unknown[]).slice(
          headers.length,
        );
      }
      this.table[idx] = [];
    } else {
      this.table.push([],);
      idx = this.table.length - 1;
    }
    (this.table[idx] as unknown[]).push(dateTag,);

    this.generatePropertyListValues(idx, accountList, ctxQuery,);
    this.generatePropertyListValues(idx, resourceList, ctxQuery,);
    this.generatePropertyListValues(idx, taskList, ctxQuery,);

    // Preenche colunas descontinuadas com valores antigos ou null.
    (this.table[idx] as unknown[]).push(...discColumnValues,);

    // Ordena por data ascendente, mantendo o cabeçalho (string) no topo.
    this.table.sort((l1, l2,) => {
      const a = l1[0];
      const b = l2[0];
      if (typeof a === "string") return -1;
      if (typeof b === "string") return 1;
      if (a instanceof TjTime && b instanceof TjTime) {
        return a.lessThan(b,) ? -1 : a.equals(b,) ? 0 : 1;
      }
      return 0;
    },);
  }

  /**
   * HTML do gráfico (Fase 14.22 — ChartPlotter). Desenha o SVG sobre a tabela
   * de trace; erros de dados viram aviso (fiel ao `rescue ChartPlotterError`).
   */
  to_html(): XMLElementLike[] {
    if (!this.table) this.generateIntermediateFormat();
    const html: XMLElementLike[] = [];
    const header = this.rt_to_html("header",);
    if (header) html.push(header,);
    try {
      const plotter = new ChartPlotter(
        (this.a("width",) as number) ?? 640,
        (this.a("height",) as number) ?? 480,
        this.table as unknown[][],
      );
      plotter.generate();
      html.push(createBlob(plotter.to_svg(),),);
    } catch (e) {
      if (e instanceof ChartPlotterError) {
        MessageHandlerInstance.instance.warning(
          "chartPlotterError",
          e.message,
          this.report.sourceFileInfo,
        );
      } else {
        throw e;
      }
    }
    const footer = this.rt_to_html("footer",);
    if (footer) html.push(footer,);
    return html;
  }

  /** Tabela em CSV: `TjTime` → `YYYY-MM-DD`, `null` → `''`. */
  to_csv(): unknown[][] {
    if (!this.table) this.generateIntermediateFormat();
    const out: unknown[][] = [];
    for (const line of this.table!) {
      const copy: unknown[] = [];
      for (const cell of line) {
        if (cell === null || cell === undefined) {
          copy.push("",);
        } else if (cell instanceof TjTime) {
          copy.push(cell.to_s("%Y-%m-%d",),);
        } else {
          copy.push(cell,);
        }
      }
      out.push(copy,);
    }
    return out;
  }

  /** Constrói cabeçalhos de uma lista de propriedades via `SimpleQueryExpander`. */
  private generatePropertyListHeader<T extends PropertyTreeNode,>(
    propertyList: PropertyList<T>,
    query: Query,
  ): string[] {
    const headers: string[] = [];
    const columns =
      (this.a("columns",) as TableColumnDefinition[] | undefined) ??
        [];
    const scenarios = (this.a("scenarios",) as number[] | undefined) ?? [];
    for (const columnDescr of columns) {
      query.attributeId = columnDescr.id;
      for (const scenarioIdx of scenarios) {
        query.scenarioIdx = scenarioIdx;
        for (const property of propertyList.toArray()) {
          query.property = property as unknown as PropertyTreeNode;
          const header = new SimpleQueryExpander(
            columnDescr.title ?? "",
            query,
            this.report.sourceFileInfo,
          ).expand();
          if (headers.includes(header,)) {
            MessageHandlerInstance.instance.error(
              "trace_columns_not_uniq",
              `The column title '${header}' is already used by a previous ` +
                "column. Column titles must be unique!",
              this.report.sourceFileInfo,
            );
          }
          headers.push(header,);
        }
      }
    }
    return headers;
  }

  /** Preenche a linha `idx` com os valores da lista de propriedades. */
  private generatePropertyListValues<T extends PropertyTreeNode,>(
    idx: number,
    propertyList: PropertyList<T>,
    query: Query,
  ): void {
    const columns =
      (this.a("columns",) as TableColumnDefinition[] | undefined) ??
        [];
    const scenarios = (this.a("scenarios",) as number[] | undefined) ?? [];
    const row = this.table![idx] as unknown[];
    for (const columnDescr of columns) {
      query.attributeId = columnDescr.id;
      for (const scenarioIdx of scenarios) {
        query.scenarioIdx = scenarioIdx;
        for (const property of propertyList.toArray()) {
          query.property = property as unknown as PropertyTreeNode;
          query.process();
          row.push(query.result(),);
        }
      }
    }
  }
}

/** `true` se o array de cabeçalhos antigos equivale ao novo (célula a célula). */
function headersEqual(oldHeaders: unknown[], newHeaders: string[],): boolean {
  if (oldHeaders.length !== newHeaders.length) return false;
  for (let i = 0; i < newHeaders.length; i++) {
    if (oldHeaders[i] !== newHeaders[i]) return false;
  }
  return true;
}

// Registra o conteúdo de `tracereport` na fábrica (14.11).
registerContentFactory(
  "tracereport",
  (report: unknown,): TraceReport => new TraceReport(report as Report,),
);
