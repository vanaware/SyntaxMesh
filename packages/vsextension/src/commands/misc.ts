/**
 * `commands/misc.ts` — remaining command bootstraps (22.7.6).
 *
 * Wires the export, switch-language, show-tree and open-manual commands over
 * the daemon and the pure helpers. Execution/editing commands are gated by
 * Workspace Trust via {@link guarded} (plan §8.4); the view-focus and manual
 * commands are read-only and ungated. Command titles are English (plan §8.2);
 * the manifest declares them (22.7.7).
 *
 * v1 export writes the cached master source (the execute-based model holds the
 * closure, not a re-serialized project — canonical model→`.tjp` serialization
 * is a deferred F24 delta, P4.1). Switch-language rewrites the input-file
 * `language` directive (22.7.4), distinct from translating the UI.
 *
 * Imports the `vscode` runtime, so it is type-checked here and exercised inside
 * VS Code (acceptance deferred to P7).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §8.2 (commands)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.7.6
 */
import {
  commands,
  Range,
  Uri,
  ViewColumn,
  window,
  workspace,
  WorkspaceEdit,
} from "vscode";
import type { ExtensionContext, } from "vscode";
import { getManualPage, getManualToc, } from "@vanaware/syntaxmesh/lsp-core";
import type { DaemonHost, } from "../daemon/host.ts";
import { getViews, } from "../views/host.ts";
import { rewriteLanguageDirective, } from "./input-language.ts";
import { activeMasterUri, guarded, } from "./shared.ts";
import { writeUserFile, } from "../web/write-fallback.ts";
import type { WriteStrategy, } from "../web/write-fallback.ts";

/** Escapes the HTML special characters of a manual page body/title. */
function escapeHtml(text: string,): string {
  return text.replace(/&/g, "&amp;",).replace(/</g, "&lt;",).replace(
    />/g,
    "&gt;",
  );
}

/** A script-free, strict-CSP Webview page rendering one manual page as text. */
function manualPageHtml(title: string, text: string,): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<title>${escapeHtml(title,)}</title>
</head>
<body>
<h1>${escapeHtml(title,)}</h1>
<pre>${escapeHtml(text,)}</pre>
</body>
</html>`;
}

/**
 * Registers the export/switch-language/show-tree/open-manual commands.
 *
 * @param context the extension context (owns the command disposables).
 * @param host the started daemon host.
 * @param writeStrategy the user-write strategy for the export: `direct` on
 * Desktop, `stub-first` on the Web (plan §9.2).
 */
export function registerMiscCommands(
  context: ExtensionContext,
  host: DaemonHost,
  writeStrategy: WriteStrategy = "direct",
): void {
  context.subscriptions.push(
    commands.registerCommand(
      "syntaxmesh.exportTjp",
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
          const model = host.core.cache.get(key,);
          const master = model?.files.find((f,) => f.path === model.entry) ??
            model?.files[0];
          if (model === undefined || master === undefined) {
            window.showErrorMessage("SyntaxMesh: nothing to export.",);
            return;
          }
          const base = model.entry.replace(/\.[^.]+$/, "",);
          const target = await window.showSaveDialog({
            defaultUri: Uri.joinPath(uri, "..", `${base}.tjp`,),
            filters: { "SyntaxMesh project": ["tjp", "smx",], },
            saveLabel: "Export",
          },);
          if (target === undefined) return;
          const result = await writeUserFile(
            workspace.fs,
            target,
            master.content,
            writeStrategy,
          );
          if (!result.ok) {
            window.showErrorMessage(result.error,);
            return;
          }
          window.showInformationMessage(
            `SyntaxMesh: exported ${model.entry}.`,
          );
        },),
    ),
    commands.registerCommand(
      "syntaxmesh.switchLanguage",
      () =>
        guarded(async () => {
          const editor = window.activeTextEditor;
          if (editor === undefined) {
            window.showWarningMessage(
              "SyntaxMesh: open a project file first.",
            );
            return;
          }
          const pick = await window.showQuickPick(
            ["en", "pt-BR", "es",].map((code,) => ({ label: code, })),
            { placeHolder: "Select the input language", },
          );
          if (pick === undefined) return;
          const doc = editor.document;
          const original = doc.getText();
          const rewritten = rewriteLanguageDirective(original, pick.label,);
          if (rewritten === original) {
            window.showInformationMessage("SyntaxMesh: language unchanged.",);
            return;
          }
          const edit = new WorkspaceEdit();
          edit.replace(
            doc.uri,
            new Range(doc.positionAt(0,), doc.positionAt(original.length,),),
            rewritten,
          );
          await workspace.applyEdit(edit,);
          getViews()?.refresh();
          window.showInformationMessage(
            `SyntaxMesh: language set to ${pick.label}.`,
          );
        },),
    ),
    commands.registerCommand("syntaxmesh.showProjectTree", async () => {
      getViews()?.refresh();
      await commands.executeCommand("syntaxmesh.projectTree.focus",);
    },),
    commands.registerCommand("syntaxmesh.openManual", async () => {
      const pick = await window.showQuickPick(
        getManualToc().map((entry,) => ({
          label: entry.title,
          description: entry.id,
          id: entry.id,
        })),
        { placeHolder: "Select a manual page", matchOnDescription: true, },
      );
      if (pick === undefined) return;
      const page = getManualPage(pick.id,) ?? "";
      const panel = window.createWebviewPanel(
        "syntaxmeshManual",
        `SyntaxMesh Manual: ${pick.label}`,
        ViewColumn.Beside,
        { enableScripts: false, },
      );
      panel.webview.html = manualPageHtml(pick.label, page,);
    },),
  );
}
