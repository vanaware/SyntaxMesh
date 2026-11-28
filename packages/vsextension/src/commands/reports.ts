/**
 * Canonical report command group shared by Desktop and Web (22.12.19).
 *
 * The group adapts VS Code prompts and the HTML presenter to the shared project
 * service and output host. Legacy Generate Report routing lives only in the
 * compatibility registrar; every public handler returns a structured result.
 */
import { Uri, window, workspace, } from "vscode";
import { withBusy, } from "../views/host.ts";
import type { CommandResult, } from "./contracts.ts";
import {
  commandResultOrFailure,
  guardedCommand,
} from "./execution-actions.ts";
import type { CanonicalCommandDependencies, } from "./register.ts";
import type { CommandRegistry, } from "./registry.ts";
import {
  exportReportCommand,
  listReportsCommand,
  openReportCommand,
  renderReportsCommand,
  type ReportCommandDependencies,
} from "./report-actions.ts";

/** Registers the four canonical report commands against the shared registry. */
export function registerReportGroup(
  registry: CommandRegistry,
  dependencies: CanonicalCommandDependencies,
): void {
  const actions: ReportCommandDependencies = {
    service: dependencies.service,
    projectUri: dependencies.resolveProject,
    openHtml: (entry, masterUri,) =>
      dependencies.presenter.openHtml(entry, Uri.parse(masterUri,),),
    output: dependencies.output,
    ui: {
      showErrorMessage: (message,) => {
        window.showErrorMessage(message,);
      },
      showInformationMessage: (message,) => {
        window.showInformationMessage(message,);
      },
      showQuickPick: (items, options,) =>
        Promise.resolve(window.showQuickPick(items, options,),),
      showFormatPick: (formats,) =>
        Promise.resolve(window.showQuickPick(formats, {
          placeHolder: "Select report format",
        },),),
      showSaveDialog: (options,) =>
        Promise.resolve(
          window.showSaveDialog({
            defaultUri: Uri.parse(options.defaultUri,),
            saveLabel: "Export Report",
          },),
        ).then((selected,) => selected?.toString()),
    },
  };
  const withResult = <T,>(
    action: () => Promise<CommandResult<T> | undefined>,
  ): Promise<CommandResult<T>> =>
    guardedCommand(
      workspace.isTrusted,
      async () =>
        commandResultOrFailure(
          await withBusy(action,),
          "report command cancelled",
        ),
      (message,) => window.showErrorMessage(message,),
    );

  registry.register(
    "syntaxmesh.report.list",
    (project?: string, pattern?: string,) =>
      withResult(() => listReportsCommand(project, pattern, actions,)),
  );
  registry.register(
    "syntaxmesh.report.render",
    (
      project?: string,
      report?: string,
      reportsIsRegex?: boolean,
      dynamicAttributes?: string,
    ) =>
      withResult(() =>
        renderReportsCommand(
          project,
          report,
          reportsIsRegex,
          dynamicAttributes,
          actions,
        )
      ),
  );
  registry.register(
    "syntaxmesh.report.open",
    (project?: string, reportId?: string, dynamicAttributes?: string,) =>
      withResult(() =>
        openReportCommand(project, reportId, dynamicAttributes, actions,)
      ),
  );
  registry.register(
    "syntaxmesh.report.export",
    (
      project?: string,
      reportId?: string,
      format?: string,
      dynamicAttributes?: string,
      targetRootUri?: string,
      fileName?: string,
    ) =>
      withResult(() =>
        exportReportCommand(
          project,
          reportId,
          format,
          dynamicAttributes,
          targetRootUri,
          fileName,
          actions,
        )
      ),
  );
}
