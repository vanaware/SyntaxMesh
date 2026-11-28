/**
 * UI-free command contracts shared by palette, tree, status-bar and console
 * adapters. Values crossing this boundary are plain data; failures are returned
 * as {@link CommandResult} rather than thrown into an adapter.
 */
import type {
  ExecutionMessage,
  ExecutionResult,
  ListReportsEntry,
  ReportJsonEntry,
} from "@vanaware/syntaxmesh";
import type { ProjectModel, ProjectSummary, } from "../daemon/types.ts";
import type { BuildRequestOptions, } from "../daemon/request-builder.ts";

export type { ProjectIntent, } from "../daemon/types.ts";

/** Successful value or structured failure from a command service. */
export type CommandResult<T,> =
  | { ok: true; value: T; messages: ExecutionMessage[] }
  | { ok: false; error: string; messages: ExecutionMessage[] };

/** Host-specific interactive console lifecycle shared by Desktop and Web. */
export interface ConsoleAdapter {
  open(): Promise<void>;
  clear(): void;
  dispose(): void;
}

/** Project operations supplied by the daemon host adapter. */
export interface ProjectCommandPort {
  addProject(uri: string,): Promise<ProjectModel>;
  refreshProject(uri: string,): Promise<ProjectModel>;
  removeProject(uri: string,): Promise<boolean>;
  listProjects(): ProjectSummary[];
  setActiveProject(
    uri: string,
  ): ProjectModel | undefined | Promise<ProjectModel | undefined>;
  activeProject(): ProjectModel | undefined;
}

/** Reusable project service consumed by command adapters. */
export interface ProjectCommandService {
  addProject(uri: string,): Promise<CommandResult<ProjectModel>>;
  refreshProject(uri: string,): Promise<CommandResult<ProjectModel>>;
  removeProject(uri: string,): Promise<CommandResult<null>>;
  listProjects(): Promise<CommandResult<ProjectSummary[]>>;
  setActiveProject(uri: string,): Promise<CommandResult<ProjectModel>>;
  resolveProject(explicit?: string,): CommandResult<string>;
}

/** Execution options shared by compile/check/schedule/freeze/sheet commands. */
export interface ExecutionCommandOptions {
  /** YAML configuration URI hydrated by the host before execution. */
  configUri?: string;
  /** Destination directory echoed in the reports section. */
  outputDir?: string;
  /** Exact report id to generate. */
  report?: string;
  /** Whether {@link ExecutionCommandOptions.report} is a regular expression. */
  reportsIsRegex?: boolean;
  /** Raw `-A` attribute snippet applied to generated reports. */
  dynamicAttributes?: string;
  /** Render reports even when the pipeline reports errors. */
  forceReports?: boolean;
  /** Treat warnings as errors. */
  abortOnWarnings?: boolean;
  /** Report time-sheet deltas. */
  warnTsDeltas?: boolean;
  /** Enable trace reports. */
  addTrace?: boolean;
}

/** Report selection forwarded to the core's in-memory render pipeline. */
export interface ReportSelection {
  /** Exact report id or regular expression; absent renders every report. */
  report?: string;
  /** Whether {@link ReportSelection.report} is a regular expression. */
  reportsIsRegex?: boolean;
  /** Raw `-A` attribute snippet applied to generated reports. */
  dynamicAttributes?: string;
}

/** Project port plus the general F24 execution operation. */
export interface ExecutionCommandPort extends ProjectCommandPort {
  /** Cached report inventory from the project's last add/reload envelope. */
  listReports(uri: string,): ListReportsEntry[];
  executeProject(
    uri: string,
    options: BuildRequestOptions,
  ): Promise<ExecutionResult>;
}

/** Semantic execution operations over the shared project service. */
export interface ExecutionCommandService extends ProjectCommandService {
  /** Executes one general F24 request over the shared cached project service. */
  executeProject(
    uri: string,
    options: BuildRequestOptions,
  ): Promise<CommandResult<ExecutionResult>>;
  compile(
    uri: string,
    options?: ExecutionCommandOptions,
  ): Promise<CommandResult<ExecutionResult>>;
  checkSyntax(
    uri: string,
    options?: ExecutionCommandOptions,
  ): Promise<CommandResult<ExecutionResult>>;
  scheduleOnly(
    uri: string,
    options?: ExecutionCommandOptions,
  ): Promise<CommandResult<ExecutionResult>>;
  freeze(
    uri: string,
    freezeDate?: string,
    byTask?: boolean,
    options?: ExecutionCommandOptions,
  ): Promise<CommandResult<ExecutionResult>>;
  checkTimeSheet(
    uri: string,
    sheetUri?: string,
    options?: ExecutionCommandOptions,
  ): Promise<CommandResult<ExecutionResult>>;
  checkStatusSheet(
    uri: string,
    sheetUri?: string,
    options?: ExecutionCommandOptions,
  ): Promise<CommandResult<ExecutionResult>>;
  listReports(
    uri: string,
    pattern?: string,
  ): Promise<CommandResult<ListReportsEntry[]>>;
  renderReports(
    uri: string,
    selection: ReportSelection,
  ): Promise<CommandResult<ExecutionResult>>;
  renderReport(
    uri: string,
    reportId: string,
    dynamicAttributes?: string,
  ): Promise<CommandResult<ReportJsonEntry>>;
}

/** Editor metadata needed to validate a possible project master. */
export interface ProjectDocumentRef {
  uri: string;
  languageId: string;
}

/** File classes produced by execution and report commands. */
export type ArtifactKind =
  | "report"
  | "freeze"
  | "manual"
  | "sheet"
  | "email"
  | "asset"
  | "image";

/** One artifact resolved by the output host. */
export interface ArtifactResult {
  uri: string;
  fileName: string;
  kind: ArtifactKind;
}

/** Commands exposed in the palette and other public UI surfaces. */
export const PUBLIC_COMMAND_IDS = [
  "syntaxmesh.project.add",
  "syntaxmesh.project.remove",
  "syntaxmesh.project.list",
  "syntaxmesh.project.setActive",
  "syntaxmesh.project.refresh",
  "syntaxmesh.compile",
  "syntaxmesh.checkSyntax",
  "syntaxmesh.scheduleOnly",
  "syntaxmesh.freeze",
  "syntaxmesh.checkTimeSheet",
  "syntaxmesh.checkStatusSheet",
  "syntaxmesh.run",
  "syntaxmesh.console.open",
  "syntaxmesh.sheet.time.send",
  "syntaxmesh.sheet.time.receive",
  "syntaxmesh.sheet.time.summary",
  "syntaxmesh.sheet.status.send",
  "syntaxmesh.sheet.status.receive",
  "syntaxmesh.report.list",
  "syntaxmesh.report.render",
  "syntaxmesh.report.open",
  "syntaxmesh.report.export",
  "syntaxmesh.help",
  "syntaxmesh.version",
  "syntaxmesh.man",
  "syntaxmesh.exportTjp",
  "syntaxmesh.switchLanguage",
  "syntaxmesh.showProjectTree",
  "syntaxmesh.openManual",
] as const;

/** Temporary compatibility aliases retained for existing programmatic callers. */
export const LEGACY_COMMAND_IDS = [
  "syntaxmesh.addProject",
  "syntaxmesh.reloadProject",
  "syntaxmesh.removeProject",
  "syntaxmesh.listProjects",
  "syntaxmesh.generateReport",
] as const;

/** Registered commands that must not appear in the public manifest. */
export const RUNTIME_ONLY_COMMAND_IDS = [
  "syntaxmesh.console.clear",
] as const;
