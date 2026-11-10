/**
 * Barrel of the Reports subsystem (phase 14).
 *
 * Exports classes incrementally as sub-phases 14.x land. Reports run in the
 * browser and return strings (ADR 027); no disk writes happen in core.
 *
 * @see docs/syntaxmesh/decisoes/027-reports-browser.md
 */

export { CSVFile, } from "./csv-file.ts";
export { type AttributeBackup, ReportContext, } from "./report-context.ts";
export { type OpenNodes, ReportBase, } from "./report-base.ts";
export {
  CellSettingPattern,
  CellSettingPatternList,
  TableColumnDefinition,
} from "./table-column-definition.ts";
export { TableColumnSorter, } from "./table-column-sorter.ts";
export { ReportTableLegend, } from "./report-table-legend.ts";
export {
  type AnyTableCell,
  type CellAlignment,
  type EmbeddedLine,
  PlaceHolderCell,
  ReportTableCell,
  type SpecialCell,
  type TableCellLine,
  type TableCellTable,
} from "./report-table-cell.ts";
export { type LineTable, ReportTableLine, } from "./report-table-line.ts";
export { type ColumnHost, ReportTableColumn, } from "./report-table-column.ts";
export { ReportTable, } from "./report-table.ts";
export { ColumnTable, } from "./column-table.ts";
export { TableReportColumn, } from "./table-report-column.ts";
export { TableReport, } from "./table-report.ts";
export { TaskListRE, } from "./task-list-re.ts";
export { ResourceListRE, } from "./resource-list-re.ts";
export { AccountListRE, } from "./account-list-re.ts";
export { MaterialListRE, } from "./material-list-re.ts";
export {
  type BreakdownContributor,
  type BreakdownContributorKind,
  type BreakdownGroup,
  type BreakdownGroupBy,
  BreakdownReport,
  type BreakdownTotals,
} from "./breakdown-report.ts";
export { TextReport, } from "./text-report.ts";
export {
  type RdoEntry,
  type RdoGroup,
  type RdoGroupBy,
  type RdoImage,
  RdoReport,
  type RdoTableKind,
  type RdoTableRow,
} from "./rdo-report.ts";
export { daytimeToS, durationToMsp, MspXmlRE, } from "./msp-xml-re.ts";
export { TjpExportRE, } from "./tjp-export-re.ts";
export { ExportRE, } from "./export-re.ts";
// 17.14: the minimal `reports/i-calendar.ts` was deleted; the names now come
// from the real `ICalendar` in `src/ical/` (port of `ICalendar.rb`, 17.5/17.6).
export {
  Component,
  Event,
  foldLines,
  ICalendar,
  // Alias since phase 16: `Journal` at the top of the package is the journal
  // model (ADR 029); this one is the iCalendar `JOURNAL` component (RFC 5545).
  Journal as ICalJournal,
  Person,
  Todo,
} from "../ical/mod.ts";
export { ICalReport, } from "./i-cal-report.ts";
export { TagFile, TagFileEntry, type TagKind, } from "./tag-file.ts";
export { NikuProject, NikuReport, NikuResource, } from "./niku-report.ts";
export { TraceReport, type TraceTable, } from "./trace-report.ts";
export { picturesToHtml, } from "./gallery.ts";
export { Navigator, NavigatorElement, } from "./navigator.ts";
// Fase 18 — templates de time/status sheet (18.6/18.8).
export {
  TimeSheetReport,
  type TSResourceRecord,
  type TSTaskRecord,
} from "./time-sheet-report.ts";
export {
  indentBlock as indentStatusBlock,
  ManagerResponsibilities,
  ManagerStatusRecord,
  StatusSheetReport,
} from "./status-sheet-report.ts";

// Phase 24 — `results.reports` section of the execution envelope (ADR 034).
export {
  type FormatContent,
  renderReports,
  type RenderReportsOptions,
  type ReportJsonEntry,
  type ReportsJson,
} from "./reports-json.ts";
