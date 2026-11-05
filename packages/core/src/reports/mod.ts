/**
 * Barrel do subsistema Reports (Fase 14).
 *
 * Exporta incrementalmente as classes conforme as subfases 14.x são entregues.
 * Os relatórios rodam no browser e retornam strings (ADR 027); nenhuma escrita
 * a disco acontece no core.
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
// 17.14: o mínimo `reports/i-calendar.ts` foi apagado; os nomes vêm agora do
// `ICalendar` real de `src/ical/` (port de `ICalendar.rb`, 17.5/17.6).
export {
  Component,
  Event,
  foldLines,
  ICalendar,
  // Alias desde a Fase 16: `Journal` no topo do pacote é o modelo de journal
  // (ADR 029); este é o componente `JOURNAL` do iCalendar (RFC 5545).
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
