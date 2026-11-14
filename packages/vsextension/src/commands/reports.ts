/**
 * `commands/reports.ts` — Generate Report command bootstrap (22.6.5).
 *
 * Wires the report flow over the daemon and the presenter: pick the active
 * project (adding it on demand), list its reports, let the user choose one,
 * generate it (re-parse + re-schedule via `execute`), then branch on the output
 * policy — HTML to a Webview, other formats saved (22.6.4). All selection and
 * policy logic is pure (22.6.1/22.6.2); this file only wires VS Code UI.
 *
 * Imports the `vscode` runtime, so it is type-checked here and exercised inside
 * VS Code (acceptance deferred to P7). Gated by Workspace Trust via the shared
 * {@link guarded} helper (plan §8.4).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.3/§8.2
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.6.5
 */
import { commands, window, workspace, } from "vscode";
import type { ExtensionContext, } from "vscode";
import type { DaemonHost, } from "../daemon/host.ts";
import type { ReportPresenter, } from "../reports/host.ts";
import { chooseFormat, quickPickItems, } from "../reports/report-selector.ts";
import { activeMasterUri, guarded, } from "./shared.ts";

/**
 * Registers the Generate Report command on the extension context.
 *
 * @param context the extension context (owns the command disposable).
 * @param host the started daemon host.
 * @param presenter the report presenter (Webview/save).
 */
export function registerReportCommands(
  context: ExtensionContext,
  host: DaemonHost,
  presenter: ReportPresenter,
): void {
  context.subscriptions.push(
    commands.registerCommand(
      "syntaxmesh.generateReport",
      () =>
        guarded(async () => {
          const uri = activeMasterUri();
          if (uri === undefined) {
            window.showWarningMessage(
              "SyntaxMesh: open a project file first.",
            );
            return;
          }
          const key = uri.toString();
          if (!host.core.cache.has(key,)) await host.addProject(uri,);

          const reports = host.core.listReports(key,);
          if (reports.length === 0) {
            window.showInformationMessage("SyntaxMesh: no reports declared.",);
            return;
          }
          const pick = await window.showQuickPick(quickPickItems(reports,), {
            placeHolder: "Select a report to generate",
          },);
          if (pick === undefined) return;

          const envelope = await host.core.generateReport(key, pick.report,);
          const section = envelope.results.reports;
          const entry = section?.reports[0];
          if (!envelope.ok || entry === undefined) {
            const errors = section?.reports.flatMap((r,) => r.errors) ?? [];
            window.showErrorMessage(
              `SyntaxMesh: report failed. ${errors.join(" ",)}`.trim(),
            );
            return;
          }
          if (entry.errors.length > 0) {
            window.showErrorMessage(`SyntaxMesh: ${entry.errors.join(" ",)}`,);
            return;
          }

          const defaultFormat = workspace.getConfiguration("syntaxmesh",)
            .get<string>("report.defaultFormat", "html",);
          const format = chooseFormat(entry, defaultFormat,);
          const content = entry.formats.find((f,) =>
            f.format === format
          )?.content ?? "";
          await presenter.present(entry, format, content, uri,);
        },),
    ),
  );
}
