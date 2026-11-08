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
export { normalizeInputPath, } from "./paths.ts";
export {
  anchoredSheetSection,
  checkSection,
  checkSheetSection,
  freezeSection,
  helpSection,
  listReportsSection,
  manSection,
  OPTION_SPECS,
  reportsSection,
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
  FreezeSection,
  ListReportsEntry,
  ManSection,
  OptionSpec,
  SheetAppName,
  SheetSection,
} from "./types.ts";
