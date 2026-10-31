/**
 * TableReport (Fase 14.12) — classe base de todos os relatórios tabulares.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/TableReport.rb`.
 * Constrói o formato intermediário (`ReportTable`) linha a linha: gera as
 * colunas de cabeçalho, as listas de contas/tarefas/recursos e cada célula
 * (padrão, calculada ou de calendário). `to_html` monta a moldura HTML e
 * `to_csv` delega à tabela.
 *
 * A coluna `chart` exige `GanttChart` (Fase 15/16); enquanto não portada, é
 * guardada com `NotYetImplementedError`. Nenhuma escrita a disco acontece (ADR
 * 027) — as saídas retornam estruturas/strings.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.12)
 */
import type { Report, } from "../model/report.ts";
import { Task, } from "../model/task.ts";
import { Resource, } from "../model/resource.ts";
import { Account, } from "../model/account.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { PropertyList, } from "../model/property-list.ts";
import type { PropertySet, } from "../model/property-set.ts";
import { AttributeType, } from "../attributes/attribute-type.ts";
import { Query, } from "../query/query.ts";
import { TjTime, } from "../time/tj-time.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { RichText, } from "../richtext/rich-text.ts";
import {
  createComment,
  SimpleXMLElement,
  type XMLElementLike,
} from "../richtext/xml-like.ts";
import { ReportBase, } from "./report-base.ts";
import { ReportTable, } from "./report-table.ts";
import { ReportTableColumn, } from "./report-table-column.ts";
import { ReportTableLine, } from "./report-table-line.ts";
import {
  PlaceHolderCell,
  ReportTableCell,
  type SpecialCell,
} from "./report-table-cell.ts";
import { ReportTableLegend, } from "./report-table-legend.ts";
import { ColumnTable, } from "./column-table.ts";
import type { TableColumnDefinition, } from "./table-column-definition.ts";
import { TableReportColumn, } from "./table-report-column.ts";
import { NotYetImplementedError, } from "../model/errors.ts";

/** Alinhamento de coluna (subconjunto de `CellAlignment` usado nas tabelas). */
type ColumnAlign = "left" | "right";

/** Callback que avança um `TjTime` para o próximo intervalo de coluna. */
type SameTimeNext = (t: TjTime,) => TjTime;

export abstract class TableReport extends ReportBase {
  /** Metadados por coluna pré-definida: [título, indent, alinhamento, por-cenário]. */
  static readonly propertiesById: Map<
    string,
    [string, boolean, ColumnAlign, boolean,]
  > = new Map<string, [string, boolean, ColumnAlign, boolean,]>([
    ["activetasks", ["Active Tasks", true, "right", true,],],
    ["annualleave", ["Annual Leave", true, "right", true,],],
    ["annualleavebalance", ["Annual Leave Balance", false, "right", true,],],
    ["annualleavelist", ["Annual Leave List", false, "left", true,],],
    ["alert", ["Alert", true, "left", false,],],
    ["alertmessages", ["Alert Messages", false, "left", false,],],
    ["alertsummaries", ["Alert Summaries", false, "left", false,],],
    ["alerttrend", ["Alert Trend", false, "left", false,],],
    ["balance", ["Balance", true, "right", true,],],
    ["bsi", ["BSI", false, "left", false,],],
    ["children", ["Children", false, "left", false,],],
    ["closedtasks", ["Closed Tasks", true, "right", true,],],
    ["competitorcount", ["Competitor count", true, "right", true,],],
    ["competitors", ["Competitors", true, "left", true,],],
    ["complete", ["Completion", false, "right", true,],],
    ["cost", ["Cost", true, "right", true,],],
    ["duration", ["Duration", true, "right", true,],],
    ["effort", ["Effort", true, "right", true,],],
    ["effortdone", ["Effort Done", true, "right", true,],],
    ["effortleft", ["Effort Left", true, "right", true,],],
    ["freetime", ["Free Time", true, "right", true,],],
    ["freework", ["Free Work", true, "right", true,],],
    ["followers", ["Followers", false, "left", true,],],
    ["fte", ["FTE", true, "right", true,],],
    ["headcount", ["Headcount", true, "right", true,],],
    ["id", ["Id", false, "left", false,],],
    ["inputs", ["Inputs", false, "left", true,],],
    ["journal", ["Journal", false, "left", false,],],
    ["journal_sub", ["Journal", false, "left", false,],],
    ["journalmessages", ["Journal Messages", false, "left", false,],],
    ["journalsummaries", ["Journal Summaries", false, "left", false,],],
    ["line", ["Line No.", false, "right", false,],],
    ["name", ["Name", true, "left", false,],],
    ["no", ["No.", false, "right", false,],],
    ["opentasks", ["Open Tasks", true, "right", true,],],
    ["precursors", ["Precursors", false, "left", true,],],
    ["rate", ["Rate", true, "right", true,],],
    ["resources", ["Resources", false, "left", true,],],
    ["responsible", ["Responsible", false, "left", true,],],
    ["revenue", ["Revenue", true, "right", true,],],
    ["scenario", ["Scenario", false, "left", true,],],
    ["scheduling", ["Scheduling Mode", true, "left", true,],],
    ["sickleave", ["Sick Leave", true, "right", true,],],
    ["specialleave", ["Special Leave", true, "right", true,],],
    ["status", ["Status", false, "left", true,],],
    ["targets", ["Targets", false, "left", true,],],
    ["unpaidleave", ["Unpaid Leave", true, "right", true,],],
  ],);

  /** Comportamento padrão por tipo de atributo: [indent, alinhamento]. */
  static readonly propertiesByType: Map<
    AttributeType,
    [boolean, ColumnAlign,]
  > = new Map<AttributeType, [boolean, ColumnAlign,]>([
    [AttributeType.Date, [false, "left",],],
    [AttributeType.Integer, [false, "right",],],
    [AttributeType.Float, [false, "right",],],
    [AttributeType.ResourceList, [false, "left",],],
    [AttributeType.RichText, [false, "left",],],
    [AttributeType.String, [false, "left",],],
  ],);

  legend: ReportTableLegend;
  protected table: ReportTable | null = null;
  protected columns: Map<TableColumnDefinition, TableReportColumn> = new Map();

  /**
   * Formato intermediário (ReportTable) gerado por `generateIntermediateFormat`.
   * Exposição somente-leitura para os golden tests da Fase 14.23, que comparam
   * a estrutura da tabela (e não o markup) entre o motor TS e o tj3 Ruby.
   */
  getTable(): ReportTable | null {
    return this.table;
  }

  constructor(report: Report,) {
    super(report,);
    // Este objeto passa a ser o conteúdo intermediário do relatório.
    report.content = this as unknown as Report["content"];
    this.legend = new ReportTableLegend();
  }

  // ------------------------------------------------------------------
  // Métodos estáticos (14.12.2)
  // ------------------------------------------------------------------

  /** Título padrão da coluna `id` ('' para colunas especiais sem título). */
  static defaultColumnTitle(id: string,): string {
    const specials = [
      "chart",
      "hourly",
      "daily",
      "weekly",
      "monthly",
      "quarterly",
      "yearly",
    ];
    if (specials.includes(id,)) return "";
    const entry = TableReport.propertiesById.get(id,);
    return entry ? entry[0] : "";
  }

  /** A coluna deve ser indentada? (por `colId` ou por tipo de propriedade). */
  static indent(
    colId: string,
    propertyType: AttributeType | undefined,
  ): boolean {
    const byId = TableReport.propertiesById.get(colId,);
    if (byId) return byId[1];
    const byType = propertyType === undefined
      ? undefined
      : TableReport.propertiesByType.get(propertyType,);
    return byType ? byType[0] : false;
  }

  /** Alinhamento da coluna. */
  static alignment(
    colId: string,
    attributeType: AttributeType | undefined,
  ): ColumnAlign | "center" {
    const byId = TableReport.propertiesById.get(colId,);
    if (byId) return byId[2];
    const byType = attributeType === undefined
      ? undefined
      : TableReport.propertiesByType.get(attributeType,);
    return byType ? byType[1] : "center";
  }

  /** Os valores da coluna `colId` são calculados (não é atributo direto)? */
  static calculated(colId: string,): boolean {
    return TableReport.propertiesById.has(colId,);
  }

  /** Os valores da coluna `colId` são específicos de cenário? */
  static scenarioSpecific(colId: string,): boolean {
    const entry = TableReport.propertiesById.get(colId,);
    return entry ? entry[3] : false;
  }

  // ------------------------------------------------------------------
  // Saídas (14.12.3)
  // ------------------------------------------------------------------

  /** Converte o relatório em uma árvore de elementos HTML. */
  to_html(): XMLElementLike[] {
    const html: XMLElementLike[] = [];
    const ctx = this.project.reportContexts.at(-1,);
    html.push(createComment(
      `Dynamic Report ID: ${ctx ? ctx.dynamicReportId : ""}`,
    ),);

    const header = this.rt_to_html("header",);
    if (header) html.push(header,);

    const tableFrame = this.generateHtmlTableFrame();
    html.push(tableFrame,);

    // A tabela de dados propriamente dita.
    if (this.table) {
      const td = new SimpleXMLElement("td",);
      td.append(this.table.to_html(),);
      tableFrame.append(this.generateHtmlTableRow(td,),);
    }

    // Legenda embutida como RichText no rodapé da tabela.
    const caption = this.a("caption",) as {
      sectionNumbers: boolean;
      to_html(): XMLElementLike | null;
    } | null;
    if (caption) {
      const td = new SimpleXMLElement("td",);
      const div = new SimpleXMLElement("div", { class: "tj_table_caption", },);
      caption.sectionNumbers = false;
      const capHtml = caption.to_html();
      if (capHtml) div.append(capHtml,);
      td.append(div,);
      tableFrame.append(this.generateHtmlTableRow(td,),);
    }

    // A legenda.
    const legendTd = new SimpleXMLElement("td",);
    const legendHtml = this.legend.to_html();
    if (legendHtml) legendTd.append(legendHtml,);
    tableFrame.append(this.generateHtmlTableRow(legendTd,),);

    const footer = this.rt_to_html("footer",);
    if (footer) html.push(footer,);

    return html;
  }

  /** Converte a tabela em Array-de-Arrays. */
  to_csv(): unknown[][] {
    return (this.table ? this.table.to_csv() : [[],]) as unknown[][];
  }

  // ------------------------------------------------------------------
  // Helpers protegidos (14.12.4)
  // ------------------------------------------------------------------

  /**
   * Ajusta o período da coluna quando o usuário não fixou datas: encaixa todas
   * as tarefas e adiciona ~5% de margem em cada ponta (para colunas chart e de
   * calendário). Guarda o resultado (ajustado ou não) em `@columns`.
   */
  protected adjustColumnPeriod(
    columnDef: TableColumnDefinition,
    tasks: Task[] = [],
    scenarios: number[] = [],
  ): void {
    let doNotAdjustStart = false;
    let doNotAdjustEnd = false;

    let rStart: TjTime | null;
    let rEnd: TjTime | null;
    if (columnDef.start) {
      rStart = columnDef.start;
      doNotAdjustStart = true;
    } else {
      rStart = this.a("start",) as TjTime;
      if (rStart !== (this.project.get("start",) as TjTime)) {
        doNotAdjustStart = true;
      }
    }
    if (columnDef.end) {
      rEnd = columnDef.end;
      doNotAdjustEnd = true;
    } else {
      rEnd = this.a("end",) as TjTime;
      if (rEnd !== (this.project.get("end",) as TjTime)) doNotAdjustEnd = true;
    }
    const origStart = rStart;
    const origEnd = rEnd;

    this.columns.set(columnDef, new TableReportColumn(rStart, rEnd,),);

    if (
      tasks.length === 0 || scenarios.length === 0 ||
      (doNotAdjustStart && doNotAdjustEnd)
    ) {
      return;
    }

    rStart = null;
    rEnd = null;
    for (const scenarioIdx of scenarios) {
      for (const task of tasks) {
        const s = (this.scenarioTime(task, "start", scenarioIdx,) ??
          this.project.get("start",)) as TjTime;
        if (rStart === null || s.compareTo(rStart,) < 0) rStart = s;
        const e = (this.scenarioTime(task, "end", scenarioIdx,) ??
          this.project.get("end",)) as TjTime;
        if (rEnd === null || e.compareTo(rEnd,) > 0) rEnd = e;
      }
    }
    if (!rStart || !rEnd) return;

    let margin = 0;
    let minWidth = rEnd.diff(rStart,) + 1;
    const mwMap: Record<string, [number, number, number,]> = {
      hour: [60 * 60, 18, 2,],
      day: [60 * 60 * 24, 18, 2,],
      week: [60 * 60 * 24 * 7, 6, 1,],
      month: [60 * 60 * 24 * 31, 10, 1,],
      quarter: [60 * 60 * 24 * 90, 6, 1,],
      year: [60 * 60 * 24 * 365, 4, 1,],
    };
    const calMap: Record<string, [number, number, number,]> = {
      hourly: [60 * 60, 18, 2,],
      daily: [60 * 60 * 24, 18, 2,],
      weekly: [60 * 60 * 24 * 7, 6, 1,],
      monthly: [60 * 60 * 24 * 31, 10, 1,],
      quarterly: [60 * 60 * 24 * 90, 6, 1,],
      yearly: [60 * 60 * 24 * 365, 4, 1,],
    };

    if (columnDef.id === "chart") {
      const entry = mwMap[columnDef.scale];
      if (!entry) throw new Error(`Unknown scale ${columnDef.scale}`,);
      margin = entry[0] * entry[2];
      if (minWidth < entry[0] * entry[1]) minWidth = entry[0] * entry[1];
    } else if (calMap[columnDef.id]) {
      const entry = calMap[columnDef.id]!;
      margin = entry[0] * entry[2];
      if (minWidth < entry[0] * entry[1]) minWidth = entry[0] * entry[1];
    } else {
      doNotAdjustStart = doNotAdjustEnd = true;
    }

    if (!(doNotAdjustStart && doNotAdjustEnd)) {
      if (minWidth > (rEnd.diff(rStart,) + 1)) {
        margin = Math.floor((minWidth - (rEnd.diff(rStart,) + 1)) / 2,);
      }
      rStart = rStart.addSeconds(-margin,);
      rEnd = rEnd.addSeconds(margin,);
      if (doNotAdjustStart) rStart = origStart!;
      if (doNotAdjustEnd) rEnd = origEnd!;
      if (rStart.compareTo(rEnd,) >= 0) {
        rStart = origStart;
        rEnd = origEnd;
      }
      this.columns.set(columnDef, new TableReportColumn(rStart, rEnd,),);
    }
  }

  /** Gera a célula de cabeçalho da coluna `columnDef`. */
  protected generateHeaderCell(columnDef: TableColumnDefinition,): void {
    if (!this.table) return;
    const colInfo = this.columns.get(columnDef,);
    const rStart = colInfo!.start!;
    const rEnd = colInfo!.end!;

    switch (columnDef.id) {
      case "chart":
        // Ancorado: Fase 16 — GanttChart (coluna `chart`) não portado.
        throw new NotYetImplementedError("16", "GanttChart",);
      case "hourly":
        this.genCalChartHeader(
          columnDef,
          rStart.midnight(),
          rEnd,
          (t,) => t.sameTimeNextHour(),
          "%A %Y-%m-%d",
          "%H",
        );
        break;
      case "daily":
        this.genCalChartHeader(
          columnDef,
          rStart.midnight(),
          rEnd,
          (t,) => t.sameTimeNextDay(),
          "%b %Y",
          "%d",
        );
        break;
      case "weekly":
        this.genCalChartHeader(
          columnDef,
          rStart.beginOfWeek(this.a("weekStartsMonday",) as boolean,),
          rEnd,
          (t,) => t.sameTimeNextWeek(),
          "%b %Y",
          "%d",
        );
        break;
      case "monthly":
        this.genCalChartHeader(
          columnDef,
          rStart.beginOfMonth(),
          rEnd,
          (t,) => t.sameTimeNextMonth(),
          "%Y",
          "%b",
        );
        break;
      case "quarterly":
        this.genCalChartHeader(
          columnDef,
          rStart.beginOfQuarter(),
          rEnd,
          (t,) => t.sameTimeNextQuarter(),
          "%Y",
          "Q%Q",
        );
        break;
      case "yearly":
        this.genCalChartHeader(
          columnDef,
          rStart.beginOfYear(),
          rEnd,
          (t,) => t.sameTimeNextYear(),
          null,
          "%Y",
        );
        break;
      default: {
        const column = new ReportTableColumn(
          this.table!,
          columnDef,
          columnDef.title ?? "",
        );
        column.cell1.rows = 2;
        column.cell2.hidden = true;
        if (columnDef.width !== null) column.cell1.width = columnDef.width;
        break;
      }
    }
  }

  /** Gera uma linha da tabela para cada conta de `accountList`. */
  protected generateAccountList(
    accountList: PropertyList<Account>,
    lineOffset: number,
    _mode: string,
  ): number {
    accountList.query = this.currentQuery().dup();
    const query = accountList.query!;
    accountList.sort();

    let no = lineOffset;
    let lineNo = lineOffset;
    let line: ReportTableLine | null = null;
    for (const account of accountList.toArray()) {
      query.property = account;
      no += 1;
      lineNo += 1;
      for (const scenarioIdx of this.scenarioList()) {
        query.scenarioIdx = scenarioIdx;
        line = new ReportTableLine(this.table!, account, null,);
        line.no = no;
        line.lineNo = lineNo;
        line.subLineNo = this.table!.linesCount();
        this.setIndent(
          line,
          this.a("accountroot",) as Account | null,
          accountList.treeMode(),
        );
        for (const columnDef of this.columnList()) {
          this.generateTableCell(line, columnDef, query,);
        }
      }
    }
    return lineNo;
  }

  /** Gera linhas de tarefa (e recursivamente de recursos atribuídos). */
  protected generateTaskList(
    taskList: PropertyList<Task>,
    resourceList: PropertyList<Resource> | null,
    scopeLine: ReportTableLine | null,
  ): number {
    taskList.query = this.currentQuery().dup();
    const query = taskList.query!;
    query.scopeProperty = scopeLine ? scopeLine.property : null;
    taskList.sort();

    let no = 0;
    let lineNo = scopeLine ? (scopeLine.lineNo ?? 0) : 0;
    let line: ReportTableLine | null = null;
    for (const task of taskList.toArray()) {
      query.property = task;
      query.scopeProperty = scopeLine ? scopeLine.property : null;
      no += 1;
      lineNo += 1;
      for (const scenarioIdx of this.scenarioList()) {
        query.scenarioIdx = scenarioIdx;
        line = new ReportTableLine(this.table!, task, scopeLine,);
        if (!scopeLine) line.no = no;
        line.lineNo = lineNo;
        line.subLineNo = this.table!.linesCount();
        this.setIndent(
          line,
          this.a("taskroot",) as Task | null,
          taskList.treeMode(),
        );
        for (const columnDef of this.columnList()) {
          this.generateTableCell(line, columnDef, query,);
        }
      }

      if (resourceList) {
        resourceList.setSorting(
          this.a("sortResources",) as Array<[string, boolean, number,]>,
        );
        const assigned = this.filterResourceList(
          resourceList,
          task,
          this.a("hideResource",) as never,
          this.a("rollupResource",) as never,
          this.a("openNodes",) as never,
        );
        assigned.sort();
        lineNo = this.generateResourceList(assigned, null, line!,);
      }
    }
    return lineNo;
  }

  /** Gera linhas de recurso (e recursivamente de tarefas atribuídas). */
  protected generateResourceList(
    resourceList: PropertyList<Resource>,
    taskList: PropertyList<Task> | null,
    scopeLine: ReportTableLine | null,
  ): number {
    resourceList.query = this.currentQuery().dup();
    const query = resourceList.query!;
    query.scopeProperty = scopeLine ? scopeLine.property : null;
    resourceList.sort();

    let no = 0;
    let lineNo = scopeLine ? (scopeLine.lineNo ?? 0) : 0;
    let line: ReportTableLine | null = null;
    for (const resource of resourceList.toArray()) {
      query.property = resource;
      query.scopeProperty = scopeLine ? scopeLine.property : null;
      no += 1;
      lineNo += 1;
      for (const scenarioIdx of this.scenarioList()) {
        query.scenarioIdx = scenarioIdx;
        line = new ReportTableLine(this.table!, resource, scopeLine,);
        if (!scopeLine) line.no = no;
        line.lineNo = lineNo;
        line.subLineNo = this.table!.linesCount();
        this.setIndent(
          line,
          this.a("resourceroot",) as Resource | null,
          resourceList.treeMode(),
        );
        for (const column of this.columnList()) {
          this.generateTableCell(line, column, query,);
        }
      }

      if (taskList) {
        taskList.setSorting(
          this.a("sortTasks",) as Array<[string, boolean, number,]>,
        );
        const assigned = this.filterTaskList(
          taskList,
          resource,
          this.a("hideTask",) as never,
          this.a("rollupTask",) as never,
          this.a("openNodes",) as never,
        );
        assigned.sort();
        lineNo = this.generateTaskList(assigned, null, line!,);
      }
    }
    return lineNo;
  }

  // ------------------------------------------------------------------
  // Helpers privados (14.12.5 / 14.12.6)
  // ------------------------------------------------------------------

  /** Cabeçalho das colunas de calendário (hourly..yearly) numa ColumnTable. */
  private genCalChartHeader(
    columnDef: TableColumnDefinition,
    t: TjTime,
    rEnd: TjTime,
    sameTimeNext: SameTimeNext,
    timeformat1: string | null,
    timeformat2: string | null,
  ): void {
    const tableColumn = new ReportTableColumn(this.table!, columnDef, "",);
    if (columnDef.timeformat1) timeformat1 = columnDef.timeformat1;
    if (columnDef.timeformat2) timeformat2 = columnDef.timeformat2;

    this.table!.equiLines = true;
    tableColumn.scrollbar = true;

    const table = new ColumnTable();
    tableColumn.cell1.special = table as unknown as SpecialCell;
    table.equiLines = true;
    table.selfcontained = !!this.a("selfcontained",);
    tableColumn.cell2.hidden = true;
    table.viewWidth = columnDef.width !== null ? columnDef.width : 450;

    while (t.compareTo(rEnd,) < 0) {
      let cellsInInterval = 0;
      const currentInterval = timeformat1 ? t.to_s(timeformat1,) : null;
      let firstColumn: ReportTableColumn | null = null;
      while (
        t.compareTo(rEnd,) < 0 &&
        (timeformat1 === null || t.to_s(timeformat1,) === currentInterval)
      ) {
        const nextT = sameTimeNext(t,);
        const iv = new TimeInterval(t, nextT,);
        const column = new ReportTableColumn(table, null, "",);
        column.cell1.data = t.to_s(
          this.a("timeFormat",) as string | undefined,
        );
        if (firstColumn === null) {
          firstColumn = column;
          column.cell1.text = currentInterval ?? "";
        } else {
          column.cell1.hidden = true;
        }
        column.cell2.text = t.to_s(timeformat2 ?? undefined,);
        // ~7 pixels por caractere, mínimo de 28 para boa aparência.
        const width = 8 + 7 * (column.cell2.text as string).length;
        column.cell2.width = width <= 28 ? 28 : width;
        if (!this.project.hasWorkingTime(this.project.dateToIdx(iv.start,),)) {
          column.cell2.category = "tabhead_offduty";
        }
        cellsInInterval += 1;
        t = nextT;
      }
      if (firstColumn) firstColumn.cell1.columns = cellsInInterval;
    }
  }

  /** Gera a célula (padrão, calculada, calendário ou gráfico) de `line`. */
  private generateTableCell(
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
    query: Query,
  ): boolean {
    const q = query.dup();
    q.attributeId = columnDef.id;
    q.start = this.columns.get(columnDef,)?.start ?? null;
    q.end = this.columns.get(columnDef,)?.end ?? null;
    q.listType = columnDef.listType;
    q.listItem = columnDef.listItem as string | null;

    let start: TjTime;
    let sameTimeNext: SameTimeNext;
    switch (columnDef.id) {
      case "chart":
        // Ancorado: Fase 16 — GanttLine (coluna `chart`) não portado.
        throw new NotYetImplementedError("16", "GanttLine",);
      case "hourly":
        start = q.start!.midnight();
        sameTimeNext = (t,) => t.sameTimeNextHour();
        break;
      case "daily":
        start = q.start!.midnight();
        sameTimeNext = (t,) => t.sameTimeNextDay();
        break;
      case "weekly":
        start = q.start!.beginOfWeek(this.a("weekStartsMonday",) as boolean,);
        sameTimeNext = (t,) => t.sameTimeNextWeek();
        break;
      case "monthly":
        start = q.start!.beginOfMonth();
        sameTimeNext = (t,) => t.sameTimeNextMonth();
        break;
      case "quarterly":
        start = q.start!.beginOfQuarter();
        sameTimeNext = (t,) => t.sameTimeNextQuarter();
        break;
      case "yearly":
        start = q.start!.beginOfYear();
        sameTimeNext = (t,) => t.sameTimeNextYear();
        break;
      default:
        if (TableReport.calculated(columnDef.id,)) {
          return this.genCalculatedCell(q, line, columnDef,);
        }
        return this.genStandardCell(q, line, columnDef,);
    }

    // Células de calendário vivem numa ColumnTable embutida (via special).
    const embedded = (columnDef.column as ReportTableColumn).cell1
      .special as unknown as ColumnTable;
    const tcLine = new ReportTableLine(
      embedded,
      line.property,
      line.scopeLine,
    );
    new PlaceHolderCell(line, tcLine,);
    tcLine.subLineNo = line.subLineNo;

    const property = q.property;
    if (property instanceof Task) {
      this.genCalChartTaskCell(q, tcLine, columnDef, start, sameTimeNext,);
    } else if (property instanceof Resource) {
      this.genCalChartResourceCell(q, tcLine, columnDef, start, sameTimeNext,);
    } else if (property instanceof Account) {
      this.genCalChartAccountCell(q, tcLine, columnDef, start, sameTimeNext,);
    } else {
      throw new Error(`Unknown property type ${property?.constructor.name}`,);
    }
    return true;
  }

  /** Célula padrão: valor direto de um atributo da propriedade. */
  private genStandardCell(
    query: Query,
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
  ): boolean {
    const property = line.property;
    let propertyList: PropertySet;
    if (property instanceof Task) {
      propertyList = this.project.tasks;
    } else if (property instanceof Resource) {
      propertyList = this.project.resources;
    } else if (property instanceof Account) {
      propertyList = this.project.accounts;
    } else {
      throw new Error(`Unknown property type ${property?.constructor.name}`,);
    }

    const cell = this.newCell(query, line,);
    if (
      !this.setScenarioSettings(
        cell,
        query.scenarioIdx ?? 0,
        propertyList.scenarioSpecific?.(columnDef.id,) ?? false,
      )
    ) {
      return false;
    }
    this.setStandardCellAttributes(
      query,
      cell,
      columnDef,
      propertyList.attributeType(columnDef.id,),
      line,
    );

    const cdText = columnDef.cellText.getPattern(query,);
    if (cdText) {
      cell.text = cdText as never;
    } else if (query.process()) {
      const rti = query.to_rti();
      cell.text = (rti ? rti : query.to_s()) as never;
    }

    this.setCustomCellAttributes(cell, columnDef, query,);
    this.checkCellText(cell,);
    return true;
  }

  /** Célula calculada: valor derivado (icons de alerta, name, bsi, etc.). */
  private genCalculatedCell(
    query: Query,
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
  ): boolean {
    const cell = this.newCell(query, line,);
    if (columnDef.id === "bsi") cell.force_string = true;

    if (
      !this.setScenarioSettings(
        cell,
        query.scenarioIdx ?? 0,
        TableReport.scenarioSpecific(columnDef.id,),
      )
    ) {
      return false;
    }
    this.setStandardCellAttributes(query, cell, columnDef, undefined, line,);

    if (query.process()) {
      const rti = query.to_rti();
      cell.text = (rti ? rti : query.to_s()) as never;
    }

    switch (columnDef.id) {
      case "alert": {
        const levels = this.project.get("alertLevels",) as Array<
          { id: string; color: string }
        >;
        const level = levels[query.to_sort() as number];
        if (level) {
          cell.icon = `flag-${level.id}`;
          cell.fontColor = level.color;
        }
        break;
      }
      case "alerttrend": {
        const icons = ["up", "flat", "down",];
        cell.icon = `trend-${icons[query.to_sort() as number]}`;
        break;
      }
      case "line":
        cell.text = String(line.lineNo,);
        break;
      case "name": {
        const property = query.property;
        cell.icon = property && property instanceof Task
          ? (property.container() ? "taskgroup" : "task")
          : property && property instanceof Resource
          ? (property.container() ? "resourcegroup" : "resource")
          : null;
        cell.iconTooltip = new RichText(
          `'''ID:''' ${property?.fullId ?? ""}`,
        ).generateIntermediateFormat();
        break;
      }
      case "no":
        cell.text = String(line.no,);
        break;
      case "bsi":
        if (line.scopeLine) cell.indent = 2;
        break;
      case "scenario":
        cell.text = this.project.scenario(query.scenarioIdx ?? 0,)?.name ?? "";
        break;
      default:
        break;
    }

    const cdText = columnDef.cellText.getPattern(query,);
    if (cdText) cell.text = cdText as never;

    this.setCustomCellAttributes(cell, columnDef, query,);
    this.checkCellText(cell,);
    return true;
  }

  /** Células de calendário para contas (attributeId 'balance'). */
  private genCalChartAccountCell(
    query: Query,
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
    t: TjTime,
    sameTimeNext: SameTimeNext,
  ): void {
    const q = query.dup();
    let firstCell: ReportTableCell | null = null;
    const endDate = q.end!;
    while (t.compareTo(endDate,) < 0) {
      const nextT = sameTimeNext(t,);
      q.attributeId = "balance";
      q.start = t;
      q.end = nextT;
      q.process();
      const cell = this.newCell(q, line,);
      cell.text = q.to_s();
      const cdText = columnDef.cellText.getPattern(q,);
      if (cdText) cell.text = cdText as never;
      cell.showTooltipHint = false;
      this.setAccountCellBgColor(q, line, cell,);
      this.setCustomCellAttributes(cell, columnDef, q,);
      this.tryCellMerging(cell, line, firstCell,);
      t = nextT;
      if (!firstCell) firstCell = cell;
    }
  }

  /** Células de calendário para tarefas (categoria caltask/calconttask). */
  private genCalChartTaskCell(
    query: Query,
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
    t: TjTime,
    sameTimeNext: SameTimeNext,
  ): void {
    const task = line.property as Task;
    const taskStart = this.scenarioTime(task, "start", query.scenarioIdx ?? 0,);
    const taskEnd = this.scenarioTime(task, "end", query.scenarioIdx ?? 0,);
    const taskIv = new TimeInterval(
      (taskStart ?? this.project.get("start",)) as TjTime,
      (taskEnd ?? this.project.get("end",)) as TjTime,
    );
    const q = query.dup();
    let firstCell: ReportTableCell | null = null;
    const endDate = q.end!;
    while (t.compareTo(endDate,) < 0) {
      const nextT = sameTimeNext(t,);
      const cellIv = new TimeInterval(t, nextT,);
      let cell: ReportTableCell;
      if (columnDef.content === "empty") {
        cell = this.newCell(q, line,);
      } else if (columnDef.content === "load") {
        q.attributeId = "effort";
        q.start = t;
        q.end = nextT;
        q.process();
        cell = this.newCell(q, line,);
        if (q.to_num() !== 0) cell.text = q.to_s();
      } else {
        throw new Error(`Unknown column content ${columnDef.content}`,);
      }
      const cdText = columnDef.cellText.getPattern(q,);
      if (cdText) cell.text = cdText as never;
      cell.showTooltipHint = false;

      if (cellIv.overlaps(taskIv,)) {
        cell.category = task.container() ? "calconttask" : "caltask";
      } else if (
        !this.project.isWorkingTime(this.project.dateToIdx(cellIv.start,),)
      ) {
        cell.category = "offduty";
      } else {
        cell.category = "taskcell";
      }
      cell.category += (line.subLineNo! ?? 0) % 2 === 1 ? "1" : "2";

      this.setCustomCellAttributes(cell, columnDef, q,);
      this.tryCellMerging(cell, line, firstCell,);
      t = nextT;
      if (!firstCell) firstCell = cell;
    }
    this.legend.addCalendarItem("Container Task", "calconttask1",);
    this.legend.addCalendarItem("Task", "caltask1",);
    this.legend.addCalendarItem("Off duty time", "offduty",);
  }

  /** Células de calendário para recursos (busy/loaded/free/offduty). */
  private genCalChartResourceCell(
    query: Query,
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
    t: TjTime,
    sameTimeNext: SameTimeNext,
  ): void {
    let task: Task | null = null;
    let taskIv: TimeInterval | null = null;
    if (line.scopeLine && line.scopeLine.property instanceof Task) {
      task = line.scopeLine.property as Task;
      const taskStart = this.scenarioTime(
        task,
        "start",
        query.scenarioIdx ?? 0,
      );
      const taskEnd = this.scenarioTime(task, "end", query.scenarioIdx ?? 0,);
      taskIv = new TimeInterval(
        (taskStart ?? this.project.get("start",)) as TjTime,
        (taskEnd ?? this.project.get("end",)) as TjTime,
      );
    }
    const q = query.dup();
    let firstCell: ReportTableCell | null = null;
    const endDate = q.end!;
    while (t.compareTo(endDate,) < 0) {
      const cell = this.newCell(q, line,);
      const nextT = sameTimeNext(t,);
      const cellIv = new TimeInterval(t, nextT,);
      q.scopeProperty = null;
      q.attributeId = "effort";
      q.startIdx = this.project.dateToIdx(t,);
      q.endIdx = this.project.dateToIdx(nextT,);
      q.process();
      const workLoad = q.to_num() ?? 0;
      let scaledWorkLoad = q.to_s();
      let workLoadTask = 0;
      if (task) {
        q.scopeProperty = task;
        q.process();
        workLoadTask = q.to_num() ?? 0;
        scaledWorkLoad = q.to_s();
      }
      q.attributeId = "freework";
      q.process();
      const freeLoad = q.to_num() ?? 0;

      if (columnDef.content === "load") {
        const w = task ? workLoadTask : workLoad;
        if (w > 0) cell.text = scaledWorkLoad;
      } else if (columnDef.content !== "empty") {
        throw new Error(`Unknown column content ${columnDef.content}`,);
      }

      const cdText = columnDef.cellText.getPattern(q,);
      if (cdText) cell.text = cdText as never;
      cell.tooltip = (columnDef.tooltip.getPattern(q,) ?? null) as never;
      cell.showTooltipHint = false;

      if (task && taskIv) {
        if (cellIv.overlaps(taskIv,)) {
          if (workLoadTask > 0 && freeLoad === 0) cell.category = "busy";
          else if (workLoad === 0 && freeLoad === 0) {
            cell.tooltip = null;
            cell.category = "offduty";
          } else cell.category = "loaded";
        } else {
          if (freeLoad > 0) cell.category = "free";
          else if (workLoad === 0 && freeLoad === 0) {
            cell.tooltip = null;
            cell.category = "offduty";
          } else {
            cell.tooltip = null;
            cell.category = "resourcecell";
          }
        }
      } else {
        if (workLoad > 0 && freeLoad === 0) cell.category = "busy";
        else if (workLoad > 0 && freeLoad > 0) cell.category = "loaded";
        else if (workLoad === 0 && freeLoad === 0) {
          cell.tooltip = null;
          cell.category = "offduty";
        } else cell.category = "free";
      }
      cell.category += (line.subLineNo! ?? 0) % 2 === 1 ? "1" : "2";

      this.setCustomCellAttributes(cell, columnDef, q,);
      this.tryCellMerging(cell, line, firstCell,);
      t = nextT;
      if (!firstCell) firstCell = cell;
    }
    this.legend.addCalendarItem("Resource is fully loaded", "busy1",);
    this.legend.addCalendarItem("Resource is partially loaded", "loaded1",);
    this.legend.addCalendarItem("Resource is available", "free",);
    this.legend.addCalendarItem("Off duty time", "offduty",);
  }

  /** Aplica indentação, alinhamento e cor de fundo padrão da célula. */
  private setStandardCellAttributes(
    query: Query,
    cell: ReportTableCell,
    columnDef: TableColumnDefinition,
    attributeType: AttributeType | undefined,
    line: ReportTableLine,
  ): void {
    if (TableReport.indent(columnDef.id, attributeType,)) {
      cell.indent = line.indentation;
    }
    cell.alignment = TableReport.alignment(
      columnDef.id,
      attributeType,
    ) as never;

    if (line.property instanceof Task) {
      cell.category = "taskcell";
      cell.category += (line.subLineNo! ?? 0) % 2 === 1 ? "1" : "2";
    } else if (line.property instanceof Resource) {
      cell.category = "resourcecell";
      cell.category += (line.subLineNo! ?? 0) % 2 === 1 ? "1" : "2";
    } else if (line.property instanceof Account) {
      this.setAccountCellBgColor(query, line, cell,);
    }

    if (columnDef.width !== null) cell.width = columnDef.width;
  }

  /** Aplica cores/alinhamento/tooltips personalizados do usuário à célula. */
  private setCustomCellAttributes(
    cell: ReportTableCell,
    columnDef: TableColumnDefinition,
    query: Query,
  ): void {
    const cellColor = columnDef.cellColor.getPattern(query,);
    if (cellColor) cell.cellColor = cellColor as string;
    const fontColor = columnDef.fontColor.getPattern(query,);
    if (fontColor) cell.fontColor = fontColor as string;
    const hAlign = columnDef.hAlign.getPattern(query,);
    if (hAlign) cell.alignment = hAlign as never;
    const cdTooltip = columnDef.tooltip.getPattern(query,);
    if (cdTooltip) cell.tooltip = cdTooltip as never;
  }

  /**
   * Com múltiplos cenários, atributos não-específicos de cenário só aparecem
   * na linha do primeiro cenário (com fonte maior); os demais são ocultos.
   */
  private setScenarioSettings(
    cell: ReportTableCell,
    scenarioIdx: number,
    scenarioSpecific: boolean,
  ): boolean {
    const scenarios = this.scenarioList();
    if (scenarios.length > 1 && !scenarioSpecific) {
      if (scenarioIdx === scenarios[0]) {
        cell.fontSize = 15;
      } else {
        cell.hidden = true;
        return false;
      }
      cell.rows = scenarios.length;
    }
    return true;
  }

  /** Cria uma célula nova; células de contêineres em linha bold são negrito. */
  private newCell(query: Query, line: ReportTableLine,): ReportTableCell {
    const cell = new ReportTableCell(line, query,);
    const property = line.property;
    if (property && property.container() && line.bold) cell.bold = true;
    return cell;
  }

  /** Define a indentação da linha (nível relativo à raiz; modo árvore). */
  private setIndent(
    line: ReportTableLine,
    propertyRoot: PropertyTreeNode | null,
    treeMode: boolean,
  ): void {
    const property = line.property!;
    const scopeLine = line.scopeLine;
    const level = property.level - (propertyRoot ? propertyRoot.level : 0);
    if (scopeLine) line.indentation = (scopeLine.indentation ?? 0) + 1;
    if (treeMode) {
      line.indentation += level;
      line.bold = true;
    }
  }

  /** Categoria de fundo de célula de conta (custo/receita + zebra). */
  private setAccountCellBgColor(
    query: Query,
    line: ReportTableLine,
    cell: ReportTableCell,
  ): void {
    const property = query.property;
    let prefix = "";
    const cost = query.costAccount;
    const revenue = query.revenueAccount;
    if (
      cost && property && (property.isChildOf(cost as never,) ||
        (property as unknown) === cost)
    ) {
      prefix = "cost";
    } else if (
      revenue && property && (property.isChildOf(revenue as never,) ||
        (property as unknown) === revenue)
    ) {
      prefix = "revenue";
    }
    cell.category = `${prefix}accountcell` +
      ((line.subLineNo! ?? 0) % 2 === 1 ? "1" : "2");
  }

  /** Garante texto válido; marca erro em vermelho se ausente. */
  private checkCellText(cell: ReportTableCell,): void {
    if (!cell.text) {
      cell.text = "<Error>";
      cell.fontColor = "#FF0000";
    }
  }

  /** Mescla células vazias consecutivas numa célula multi-coluna. */
  private tryCellMerging(
    cell: ReportTableCell,
    line: ReportTableLine,
    firstCell: ReportTableCell | null,
  ): void {
    if (cell.text === "" && firstCell) {
      const prev = line.last(1,) as ReportTableCell | null;
      if (prev === cell) {
        cell.hidden = true;
        prev.columns += 1;
      }
    }
  }

  // ------------------------------------------------------------------
  // Acessores internos de atributos do relatório
  // ------------------------------------------------------------------

  protected columnList(): TableColumnDefinition[] {
    return (this.a("columns",) as TableColumnDefinition[] | undefined) ?? [];
  }

  protected scenarioList(): number[] {
    return (this.a("scenarios",) as number[] | undefined) ?? [];
  }

  private scenarioTime(
    node: Task | Resource | Account,
    id: string,
    scIdx: number,
  ): TjTime | null {
    return (node.getForScenario(id, scIdx,) as TjTime | null) ?? null;
  }
}
