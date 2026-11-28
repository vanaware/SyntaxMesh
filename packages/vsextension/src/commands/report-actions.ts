/**
 * UI-free report command orchestration (22.12.7). The VS Code adapter supplies
 * project resolution, messages and the HTML presenter; this module owns argument
 * precedence, cached-report prompting and structured command results.
 */
import type {
  ExecutionResult,
  ListReportsEntry,
  ReportJsonEntry,
} from "@vanaware/syntaxmesh";
import type {
  CommandResult,
  ExecutionCommandService,
  ReportSelection,
} from "./contracts.ts";
import { exportReport, type ReportExportResult, } from "./service.ts";
import type { ConfirmedOutputHost, } from "../cli/output-host.ts";
import { reportFileName, } from "../reports/output-policy.ts";
import {
  quickPickItems,
  type ReportPickItem,
} from "../reports/report-selector.ts";

/** VS Code UI surface used by report command actions. */
export interface ReportCommandUi {
  /** Shows a command failure. */
  showErrorMessage(message: string,): void;
  /** Shows a non-error command notice. */
  showInformationMessage(message: string,): void;
  /** Prompts for one cached report. */
  showQuickPick(
    items: ReportPickItem[],
    options?: { placeHolder?: string },
  ): Promise<ReportPickItem | undefined>;
  /** Prompts for one format from the rendered report. */
  showFormatPick(formats: string[],): Promise<string | undefined>;
  /** Selects an explicit export file URI. */
  showSaveDialog(options: { defaultUri: string },): Promise<string | undefined>;
}

/** Dependencies shared by report commands. */
export interface ReportCommandDependencies {
  /** Semantic report operations over the shared project service. */
  service: Pick<
    ExecutionCommandService,
    "listReports" | "renderReports" | "renderReport"
  >;
  /** Resolves an explicit, active or single loaded project master. */
  projectUri(explicit?: string,): Promise<string | undefined>;
  /** Opens one rendered report as HTML. */
  openHtml(
    entry: ReportJsonEntry,
    masterUri: string,
  ): Promise<CommandResult<null>>;
  /** Shared preflighted output host. */
  output: ConfirmedOutputHost;
  /** Message and prompt adapter. */
  ui: ReportCommandUi;
}

/** Surfaces one structured command failure. */
function showFailure(ui: ReportCommandUi, result: { error: string },): void {
  ui.showErrorMessage(`SyntaxMesh: ${result.error}`,);
}

/** Lists cached reports, optionally filtered by a regular expression. */
export async function listReportsCommand(
  project: string | undefined,
  pattern: string | undefined,
  dependencies: ReportCommandDependencies,
): Promise<CommandResult<ListReportsEntry[]> | undefined> {
  const uri = await dependencies.projectUri(project,);
  if (uri === undefined) return undefined;
  const result = await dependencies.service.listReports(uri, pattern,);
  if (!result.ok) showFailure(dependencies.ui, result,);
  return result;
}

/** Renders an exact, regex or all-report selection without opening output. */
export async function renderReportsCommand(
  project: string | undefined,
  report: string | undefined,
  reportsIsRegex: boolean | undefined,
  dynamicAttributes: string | undefined,
  dependencies: ReportCommandDependencies,
): Promise<CommandResult<ExecutionResult> | undefined> {
  const uri = await dependencies.projectUri(project,);
  if (uri === undefined) return undefined;
  const selection: ReportSelection = {};
  if (report !== undefined) {
    selection.report = report;
    selection.reportsIsRegex = reportsIsRegex === true;
  }
  if (dynamicAttributes !== undefined) {
    selection.dynamicAttributes = dynamicAttributes;
  }
  const result = await dependencies.service.renderReports(uri, selection,);
  if (!result.ok) showFailure(dependencies.ui, result,);
  return result;
}

/** Prompts when needed, renders one exact report and opens its HTML format. */
export async function openReportCommand(
  project: string | undefined,
  reportId: string | undefined,
  dynamicAttributes: string | undefined,
  dependencies: ReportCommandDependencies,
): Promise<CommandResult<null> | undefined> {
  const uri = await dependencies.projectUri(project,);
  if (uri === undefined) return undefined;

  let selected = reportId;
  if (selected === undefined) {
    const listed = await dependencies.service.listReports(uri,);
    if (!listed.ok) {
      showFailure(dependencies.ui, listed,);
      return listed;
    }
    if (listed.value.length === 0) {
      dependencies.ui.showInformationMessage(
        "SyntaxMesh: no reports declared.",
      );
      return undefined;
    }
    const pick = await dependencies.ui.showQuickPick(
      quickPickItems(listed.value,),
      { placeHolder: "Select a report to open", },
    );
    if (pick === undefined) return undefined;
    selected = pick.report;
  }

  const rendered = await dependencies.service.renderReport(
    uri,
    selected,
    dynamicAttributes,
  );
  if (!rendered.ok) {
    showFailure(dependencies.ui, rendered,);
    return rendered;
  }
  const opened = await dependencies.openHtml(rendered.value, uri,);
  if (!opened.ok) showFailure(dependencies.ui, opened,);
  return opened;
}

/** Splits a selected file URI into its directory root and decoded basename. */
function splitDestination(uri: string,): { root: string; fileName: string } {
  const parsed = new URL(uri,);
  const fileName = decodeURIComponent(
    parsed.pathname.split("/",).filter((part,) => part !== "").at(-1,) ?? "",
  );
  parsed.pathname = parsed.pathname.replace(/[^/]*$/, "",);
  parsed.search = "";
  parsed.hash = "";
  return { root: parsed.toString(), fileName, };
}

/** Prompts when needed, renders one report and exports its selected format. */
export async function exportReportCommand(
  project: string | undefined,
  reportId: string | undefined,
  format: string | undefined,
  dynamicAttributes: string | undefined,
  targetRootUri: string | undefined,
  fileName: string | undefined,
  dependencies: ReportCommandDependencies,
): Promise<CommandResult<ReportExportResult> | undefined> {
  const uri = await dependencies.projectUri(project,);
  if (uri === undefined) return undefined;

  let selected = reportId;
  if (selected === undefined) {
    const listed = await dependencies.service.listReports(uri,);
    if (!listed.ok) {
      showFailure(dependencies.ui, listed,);
      return listed;
    }
    if (listed.value.length === 0) {
      dependencies.ui.showInformationMessage(
        "SyntaxMesh: no reports declared.",
      );
      return undefined;
    }
    const pick = await dependencies.ui.showQuickPick(
      quickPickItems(listed.value,),
      { placeHolder: "Select a report to export", },
    );
    if (pick === undefined) return undefined;
    selected = pick.report;
  }

  const selection: ReportSelection = {
    report: selected,
    reportsIsRegex: false,
    dynamicAttributes,
  };
  let rendered: CommandResult<ExecutionResult> | undefined;
  let selectedFormat = format;
  if (selectedFormat === undefined) {
    rendered = await dependencies.service.renderReports(uri, selection,);
    if (!rendered.ok) {
      showFailure(dependencies.ui, rendered,);
      return rendered;
    }
    // Exact selection is canonical-id based; the rendered entry carries the
    // display name, which may differ from that id.
    const entry = rendered.value.results.reports?.reports[0];
    if (entry === undefined || entry.errors.length > 0) {
      const failure: CommandResult<never> = entry === undefined
        ? {
          ok: false,
          error: `report not rendered: ${selected}`,
          messages: rendered.messages,
        }
        : {
          ok: false,
          error: `report ${entry.name} failed: ${entry.errors.join(" ",)}`,
          messages: rendered.messages,
        };
      showFailure(dependencies.ui, failure,);
      return failure;
    }
    const formats = entry.formats.map((item,) => item.format);
    if (formats.length === 0) {
      const failure: CommandResult<never> = {
        ok: false,
        error: `report ${entry.name} has no formats`,
        messages: rendered.messages,
      };
      showFailure(dependencies.ui, failure,);
      return failure;
    }
    selectedFormat = await dependencies.ui.showFormatPick(formats,);
    if (selectedFormat === undefined) return undefined;
  }

  let root = targetRootUri;
  let selectedFileName = fileName ?? reportFileName(selected, selectedFormat,);
  if (root === undefined) {
    const defaultUri = new URL(
      selectedFileName,
      new URL(".", uri,),
    ).toString();
    const destination = await dependencies.ui.showSaveDialog({
      defaultUri,
    },);
    if (destination === undefined) return undefined;
    const split = splitDestination(destination,);
    root = split.root;
    selectedFileName = split.fileName;
  }

  const result = await exportReport({
    projectUri: uri,
    reportId: selected,
    format: selectedFormat,
    dynamicAttributes,
    targetRootUri: root,
    fileName: selectedFileName,
  }, {
    renderReports: rendered === undefined
      ? (projectUri, requested,) =>
        dependencies.service.renderReports(projectUri, requested,)
      : () => Promise.resolve(rendered,),
    output: dependencies.output,
  },);
  if (!result.ok) showFailure(dependencies.ui, result,);
  return result;
}
