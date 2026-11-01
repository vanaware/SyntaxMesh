/**
 * Tipos de relatório suportados pelo TaskJuggler.
 *
 * @see docs/tj3-engine/18-nlueprint-report.md
 */
export enum ReportType {
  AccountReport = "AccountReport",
  // Extensões SyntaxMesh (Fase 14 Complemento): tipos sem equivalente no TJ.
  BreakdownReport = "BreakdownReport",
  Export = "Export",
  ICal = "ICal",
  MaterialReport = "MaterialReport",
  Niku = "Niku",
  RdoReport = "RdoReport",
  ResourceReport = "ResourceReport",
  TagFile = "TagFile",
  TextReport = "TextReport",
  TaskReport = "TaskReport",
  TraceReport = "TraceReport",
  StatusSheet = "StatusSheet",
  TimeSheet = "TimeSheet",
}
