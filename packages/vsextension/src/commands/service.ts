/**
 * UI-free project, execution and report command service
 * (22.12.3/22.12.5/22.12.7). The host adapter supplies an
 * {@link ExecutionCommandPort} and optional file reader;
 * this module validates references, hydrates data, delegates and converts every
 * failure into structured data.
 */
import type {
  ArtifactResult,
  CommandResult,
  ExecutionCommandOptions,
  ExecutionCommandPort,
  ExecutionCommandService,
  ReportSelection,
} from "./contracts.ts";
import type { ConfirmedOutputHost, } from "../cli/output-host.ts";
import { resolveProjectUri, } from "./project-ref.ts";
import type { ProjectModel, ProjectSummary, } from "../daemon/types.ts";
import type { BuildRequestOptions, } from "../daemon/request-builder.ts";
import type {
  ExecutionFreezeRequest,
  ExecutionResult,
  ListReportsEntry,
  ReportJsonEntry,
} from "@vanaware/syntaxmesh";
import { loadConfig, } from "./config.ts";

/** Converts thrown values into the command failure contract. */
function failure(error: unknown,): CommandResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error,),
    messages: [],
  };
}

/** Messages produced by the project's most recent execution envelope. */
function messages(
  model: ProjectModel,
): CommandResult<ProjectModel>["messages"] {
  return model.envelope?.messages ?? [];
}

/** Project and execution operations over injected ports, without VS Code imports. */
export class ProjectService implements ExecutionCommandService {
  private readonly port: ExecutionCommandPort;
  private readonly readFile?: (uri: string,) => Promise<string>;

  /**
   * @param port the daemon operations adapted to string project URIs.
   * @param readFile host reader used for YAML configuration and sheet content.
   */
  constructor(
    port: ExecutionCommandPort,
    readFile?: (uri: string,) => Promise<string>,
  ) {
    this.port = port;
    this.readFile = readFile;
  }

  /** Resolves an explicit, active or single loaded project master. */
  resolveProject(explicit?: string,): CommandResult<string> {
    try {
      if (explicit !== undefined) {
        return resolveProjectUri({ explicit, projects: [], },);
      }
      const activeRegistry = this.port.activeProject()?.uri;
      if (activeRegistry !== undefined) {
        return resolveProjectUri({ activeRegistry, projects: [], },);
      }
      return resolveProjectUri({
        projects: this.port.listProjects().map((project,) => project.uri),
      },);
    } catch (error) {
      return failure(error,);
    }
  }

  /** Validates, hydrates and executes one semantic project request. */
  private async run(
    uri: string,
    options: ExecutionCommandOptions,
    semantic: BuildRequestOptions,
    sheetUri?: string,
  ): Promise<CommandResult<ExecutionResult>> {
    const resolved = resolveProjectUri({ explicit: uri, projects: [], },);
    if (!resolved.ok) return resolved;

    const { configUri, ...forwarded } = options;
    const request: BuildRequestOptions = { ...forwarded, ...semantic, };
    if (configUri !== undefined) {
      if (this.readFile === undefined) {
        return failure("configuration reader unavailable",);
      }
      const config = await loadConfig(configUri, this.readFile,);
      if (!config.ok) return config;
      request.configContent = config.value.configContent;
      request.configObject = config.value.configObject;
    }

    if (sheetUri !== undefined) {
      if (this.readFile === undefined) {
        return failure("sheet reader unavailable",);
      }
      let sheetContent: string;
      try {
        sheetContent = await this.readFile(sheetUri,);
      } catch (error) {
        return failure(error,);
      }
      request.appOptions = { sheetContent, sheetFile: sheetUri, };
    }

    try {
      const envelope = await this.port.executeProject(resolved.value, request,);
      return { ok: true, value: envelope, messages: envelope.messages, };
    } catch (error) {
      return failure(error,);
    }
  }

  /** Adds one master and returns its cached model and envelope messages. */
  async addProject(uri: string,): Promise<CommandResult<ProjectModel>> {
    const resolved = resolveProjectUri({ explicit: uri, projects: [], },);
    if (!resolved.ok) return resolved;
    try {
      const model = await this.port.addProject(resolved.value,);
      return { ok: true, value: model, messages: messages(model,), };
    } catch (error) {
      return failure(error,);
    }
  }

  /** Refreshes one master and returns its cached model and envelope messages. */
  async refreshProject(uri: string,): Promise<CommandResult<ProjectModel>> {
    const resolved = resolveProjectUri({ explicit: uri, projects: [], },);
    if (!resolved.ok) return resolved;
    try {
      const model = await this.port.refreshProject(resolved.value,);
      return { ok: true, value: model, messages: messages(model,), };
    } catch (error) {
      return failure(error,);
    }
  }

  /** Removes one loaded project, failing structurally when it is absent. */
  async removeProject(uri: string,): Promise<CommandResult<null>> {
    const resolved = resolveProjectUri({ explicit: uri, projects: [], },);
    if (!resolved.ok) return resolved;
    try {
      const removed = await this.port.removeProject(resolved.value,);
      if (!removed) return failure(`project not loaded: ${resolved.value}`,);
      return { ok: true, value: null, messages: [], };
    } catch (error) {
      return failure(error,);
    }
  }

  /** Lists every loaded project summary. */
  listProjects(): Promise<CommandResult<ProjectSummary[]>> {
    try {
      return Promise.resolve({
        ok: true,
        value: this.port.listProjects(),
        messages: [],
      },);
    } catch (error) {
      return Promise.resolve(failure(error,),);
    }
  }

  /** Selects one loaded project, failing structurally when it is unknown. */
  async setActiveProject(uri: string,): Promise<CommandResult<ProjectModel>> {
    const resolved = resolveProjectUri({ explicit: uri, projects: [], },);
    if (!resolved.ok) return resolved;
    try {
      const model = await this.port.setActiveProject(resolved.value,);
      if (model === undefined) {
        return failure(`project not loaded: ${resolved.value}`,);
      }
      return {
        ok: true,
        value: model,
        messages: messages(model,),
      };
    } catch (error) {
      return failure(error,);
    }
  }

  /** Executes one general F24 request through the shared project pipeline. */
  executeProject(
    uri: string,
    options: BuildRequestOptions,
  ): Promise<CommandResult<ExecutionResult>> {
    return this.run(uri, {}, options,);
  }

  /** Compiles the project and returns every report as in-memory data. */
  compile(
    uri: string,
    options: ExecutionCommandOptions = {},
  ): Promise<CommandResult<ExecutionResult>> {
    return this.run(uri, options, {},);
  }

  /** Parses the project without scheduling it. */
  checkSyntax(
    uri: string,
    options: ExecutionCommandOptions = {},
  ): Promise<CommandResult<ExecutionResult>> {
    return this.run(uri, options, { checkSyntax: true, },);
  }

  /** Schedules the project without rendering reports. */
  scheduleOnly(
    uri: string,
    options: ExecutionCommandOptions = {},
  ): Promise<CommandResult<ExecutionResult>> {
    return this.run(uri, options, { noReports: true, },);
  }

  /** Freezes bookings at the requested date and grouping mode. */
  freeze(
    uri: string,
    freezeDate?: string,
    byTask?: boolean,
    options: ExecutionCommandOptions = {},
  ): Promise<CommandResult<ExecutionResult>> {
    const freeze: ExecutionFreezeRequest = {};
    if (freezeDate !== undefined) freeze.date = freezeDate;
    if (byTask !== undefined) freeze.byTask = byTask;
    return this.run(uri, options, { freeze, },);
  }

  /** Checks one time sheet supplied as inline content by the host. */
  checkTimeSheet(
    uri: string,
    sheetUri?: string,
    options: ExecutionCommandOptions = {},
  ): Promise<CommandResult<ExecutionResult>> {
    if (sheetUri === undefined) {
      return Promise.resolve(failure("time sheet URI is required",),);
    }
    return this.run(uri, options, { app: "check-ts", }, sheetUri,);
  }

  /** Checks one status sheet supplied as inline content by the host. */
  checkStatusSheet(
    uri: string,
    sheetUri?: string,
    options: ExecutionCommandOptions = {},
  ): Promise<CommandResult<ExecutionResult>> {
    if (sheetUri === undefined) {
      return Promise.resolve(failure("status sheet URI is required",),);
    }
    return this.run(uri, options, { app: "check-ss", }, sheetUri,);
  }

  /** Lists cached reports, optionally filtering them with a regular expression. */
  listReports(
    uri: string,
    pattern?: string,
  ): Promise<CommandResult<ListReportsEntry[]>> {
    const resolved = resolveProjectUri({ explicit: uri, projects: [], },);
    if (!resolved.ok) return Promise.resolve(resolved,);
    try {
      const reports = this.port.listReports(resolved.value,);
      if (pattern === undefined || pattern === "") {
        return Promise.resolve({ ok: true, value: reports, messages: [], },);
      }
      let matcher: RegExp;
      try {
        matcher = new RegExp(pattern,);
      } catch (error) {
        return Promise.resolve(
          failure(
            `invalid report pattern: ${
              error instanceof Error ? error.message : String(error,)
            }`,
          ),
        );
      }
      return Promise.resolve({
        ok: true,
        value: reports.filter((report,) =>
          matcher.test(report.id ?? report.name,) || matcher.test(report.name,)
        ),
        messages: [],
      },);
    } catch (error) {
      return Promise.resolve(failure(error,),);
    }
  }

  /** Renders selected reports as data without opening or writing their output. */
  renderReports(
    uri: string,
    selection: ReportSelection,
  ): Promise<CommandResult<ExecutionResult>> {
    const request: BuildRequestOptions = {};
    if (selection.report !== undefined) {
      request.report = selection.report;
      request.reportsIsRegex = selection.reportsIsRegex === true;
    }
    if (selection.dynamicAttributes !== undefined) {
      request.dynamicAttributes = selection.dynamicAttributes;
    }
    return this.run(uri, {}, request,);
  }

  /** Renders one exact report and returns its entry or a structured failure. */
  async renderReport(
    uri: string,
    reportId: string,
    dynamicAttributes?: string,
  ): Promise<CommandResult<ReportJsonEntry>> {
    const rendered = await this.renderReports(uri, {
      report: reportId,
      reportsIsRegex: false,
      dynamicAttributes,
    },);
    if (!rendered.ok) return rendered;
    const entry = rendered.value.results.reports?.reports[0];
    if (entry === undefined) {
      return {
        ok: false,
        error: `report not rendered: ${reportId}`,
        messages: rendered.messages,
      };
    }
    if (entry.errors.length > 0) {
      return {
        ok: false,
        error: `report ${entry.name} failed: ${entry.errors.join(" ",)}`,
        messages: rendered.messages,
      };
    }
    return { ok: true, value: entry, messages: rendered.messages, };
  }
}

/** Successful report export data returned after the output host confirms writes. */
export interface ReportExportResult {
  execution: ExecutionResult;
  artifact: ArtifactResult;
}

/** Explicit destination and rendering selection for one report export. */
export interface ReportExportOptions {
  projectUri: string;
  reportId: string;
  format: string;
  dynamicAttributes?: string;
  /** Directory URI selected by the command handler. */
  targetRootUri: string;
  /** Basename only; the output host rejects separators and traversal. */
  fileName: string;
}

/** Rendering and output operations required by the pure export command. */
export interface ReportExportPort {
  renderReports(
    uri: string,
    selection: ReportSelection,
  ): Promise<CommandResult<ExecutionResult>>;
  output: ConfirmedOutputHost;
}

/** Renders one report and writes only the requested format to an explicit target. */
export async function exportReport(
  options: ReportExportOptions,
  port: ReportExportPort,
): Promise<CommandResult<ReportExportResult>> {
  const rendered = await port.renderReports(options.projectUri, {
    report: options.reportId,
    reportsIsRegex: false,
    dynamicAttributes: options.dynamicAttributes,
  },);
  if (!rendered.ok) return rendered;

  const execution = rendered.value;
  if (!execution.ok) {
    return {
      ok: false,
      error: "report execution failed",
      messages: execution.messages,
    };
  }
  // Exact selection is canonical-id based; the rendered entry carries the
  // display name, which may differ from that id.
  const entry = execution.results.reports?.reports[0];
  if (entry === undefined) {
    return {
      ok: false,
      error: `report not rendered: ${options.reportId}`,
      messages: execution.messages,
    };
  }
  if (entry.errors.length > 0) {
    return {
      ok: false,
      error: `report ${entry.name} failed: ${entry.errors.join(" ",)}`,
      messages: execution.messages,
    };
  }
  const selected = entry.formats.find((format,) =>
    format.format === options.format
  );
  if (selected === undefined) {
    const available = entry.formats.length === 0
      ? "none"
      : entry.formats.map((format,) => format.format).join(", ",);
    return {
      ok: false,
      error:
        `report ${entry.name} has no ${options.format} format; available formats: ${available}`,
      messages: execution.messages,
    };
  }

  const written = await port.output.writeAll([{
    path: options.fileName,
    content: selected.content,
    kind: "report",
  },], options.targetRootUri,);
  if (!written.ok) return { ...written, messages: execution.messages, };
  const artifact = written.value[0];
  if (written.value.length !== 1 || artifact === undefined) {
    return {
      ok: false,
      error: "report export returned no artifact",
      messages: execution.messages,
    };
  }
  return {
    ok: true,
    value: { execution, artifact, },
    messages: execution.messages,
  };
}
