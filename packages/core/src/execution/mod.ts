/**
 * Execution boundary of phase 24 (ADR 034).
 *
 * Exports the public envelope contract (`ExecutionRequest`/
 * `ExecutionResult`), the single entry point `execute` and the pieces the
 * consumer may reuse (options spec of the `help` section).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.6
 */
export { execute, lastExecutedProject, } from "./execute.ts";
export {
  buildEnvelope,
  echoOptions,
  EXIT_ERROR,
  EXIT_OK,
  fileKey,
  snapshotMessages,
} from "./envelope.ts";
export { normalizeInputPath, stripExtension, } from "./paths.ts";
export {
  checkSection,
  checkSheetSection,
  freezeSection,
  helpSection,
  listReportsSection,
  manSection,
  OPTION_SPECS,
  reportsSection,
  runSheetSection,
  sheetSection,
  versionSection,
} from "./sections.ts";
export type { SheetChecker, SheetSectionOutcome, } from "./sections.ts";
export type {
  ExecutionFreezeRequest,
  ExecutionInputFile,
  ExecutionManRequest,
  ExecutionMessage,
  ExecutionOptionsEcho,
  ExecutionRequest,
  ExecutionResult,
  ExecutionResults,
  ExecutionSheetAppOptions,
  ExecutionSheetAppOptionsEcho,
  FreezeFile,
  FreezeSection,
  ListReportsEntry,
  ManSection,
  OptionSpec,
  SheetAppName,
  SheetEmail,
  SheetSection,
} from "./types.ts";
