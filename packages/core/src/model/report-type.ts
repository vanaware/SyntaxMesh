/**
 * Report types supported by TaskJuggler.
 *
 * @see docs/tj3-engine/18-nlueprint-report.md
 */
export enum ReportType {
  AccountReport = "AccountReport",
  // SyntaxMesh extensions (phase 14 complement): types without a TJ
  // equivalent.
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
