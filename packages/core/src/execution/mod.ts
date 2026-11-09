/**
 * Fronteira de execução da Fase 24 (ADR 034).
 *
 * Exporta o contrato público do envelope (`ExecutionRequest`/
 * `ExecutionResult`), o ponto único de entrada `execute` e as peças que o
 * consumidor pode reaproveitar (spec de opções da seção `help`).
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
  FreezeFile,
  FreezeSection,
  ListReportsEntry,
  ManSection,
  OptionSpec,
  SheetAppName,
  SheetEmail,
  SheetSection,
} from "./types.ts";
