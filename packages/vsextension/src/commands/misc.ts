/**
 * Canonical miscellaneous command group shared by Desktop and Web (22.12.19).
 *
 * The group owns VS Code prompts and presentation only. Project mutations use the
 * shared service, metadata/manual use the shared output host, and every public
 * handler returns a structured result for palette, programmatic and console callers.
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
import type { ExecutionMessage, ExecutionResult, } from "@vanaware/syntaxmesh";
import { getManualPage, getManualToc, } from "@vanaware/syntaxmesh/lsp-core";
import type { DaemonHost, } from "../daemon/host.ts";
import { getViews, withBusy, } from "../views/host.ts";
import { writeUserFile, } from "../web/write-fallback.ts";
import type { CommandResult, } from "./contracts.ts";
import { guardedCommand, } from "./execution-actions.ts";
import { formatHelp, } from "./help-text.ts";
import { rewriteLanguageDirective, } from "./input-language.ts";
import { executeMan, type ManFormat, } from "./manual.ts";
import {
  helpCommand,
  type MetaExecutionPort,
  versionCommand,
} from "./meta.ts";
import type { CanonicalCommandDependencies, } from "./register.ts";
import type { CommandRegistry, } from "./registry.ts";
import { activeMasterUri, } from "./shared.ts";

/** Builds one structured command failure. */
function failure(
  error: string,
  messages: ExecutionMessage[] = [],
): { ok: false; error: string; messages: ExecutionMessage[] } {
  return { ok: false, error, messages, };
}

/** Builds one successful command result without inventing execution messages. */
function success<T,>(value: T,): CommandResult<T> {
  return { ok: true, value, messages: [], };
}

/** Surfaces one service failure while preserving the returned result. */
function showFailure(result: { error: string },): void {
  window.showErrorMessage(`SyntaxMesh: ${result.error}`,);
}

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

/** Registers export, language, view, manual-page and metadata commands. */
export function registerMiscGroup(
  registry: CommandRegistry,
  dependencies: CanonicalCommandDependencies,
): void {
  const {
    host,
    service,
    output,
    writeStrategy,
    helpOutput,
    manualOutput,
  } = dependencies;
  const metadata: MetaExecutionPort = {
    execute: (request,) => host.core.executeRequest(request,),
  };
  const trusted = <T,>(
    action: () => Promise<CommandResult<T>>,
  ): Promise<CommandResult<T>> =>
    guardedCommand(
      workspace.isTrusted,
      action,
      (message,) => window.showErrorMessage(message,),
    );

  registry.register("syntaxmesh.exportTjp", () =>
    trusted(async () => {
      const active = activeMasterUri();
      if (active === undefined) {
        window.showWarningMessage("SyntaxMesh: open a project file first.",);
        return failure("open a project file first.",);
      }
      const key = active.toString();
      let model = host.core.cache.get(key,);
      if (model === undefined) {
        const loaded = await withBusy(() => service.addProject(key,));
        if (!loaded.ok) {
          showFailure(loaded,);
          return loaded;
        }
        model = loaded.value;
      }
      const master = model.files.find((file,) => file.path === model.entry) ??
        model.files[0];
      if (master === undefined) {
        const result = failure("nothing to export",);
        showFailure(result,);
        return result;
      }
      const base = model.entry.replace(/\.[^.]+$/, "",);
      const target = await window.showSaveDialog({
        defaultUri: Uri.joinPath(active, "..", `${base}.tjp`,),
        filters: { "SyntaxMesh project": ["tjp", "smx",], },
        saveLabel: "Export",
      },);
      if (target === undefined) return failure("export cancelled",);
      const written = await writeUserFile(
        workspace.fs,
        target,
        master.content,
        writeStrategy,
      );
      if (!written.ok) {
        window.showErrorMessage(written.error,);
        return failure(written.error,);
      }
      window.showInformationMessage(`SyntaxMesh: exported ${model.entry}.`,);
      return {
        ok: true,
        value: { uri: target.toString(), entry: model.entry, },
        messages: model.envelope?.messages ?? [],
      };
    },),);

  registry.register("syntaxmesh.switchLanguage", () =>
    trusted(async () => {
      const editor = window.activeTextEditor;
      if (editor === undefined) {
        window.showWarningMessage("SyntaxMesh: open a project file first.",);
        return failure("open a project file first.",);
      }
      const pick = await window.showQuickPick(
        ["en", "pt-BR", "es",].map((code,) => ({ label: code, })),
        { placeHolder: "Select the input language", },
      );
      if (pick === undefined) return failure("language selection cancelled",);
      const doc = editor.document;
      const original = doc.getText();
      const rewritten = rewriteLanguageDirective(original, pick.label,);
      if (rewritten === original) {
        window.showInformationMessage("SyntaxMesh: language unchanged.",);
        return success({ uri: doc.uri.toString(), language: pick.label, },);
      }
      const edit = new WorkspaceEdit();
      edit.replace(
        doc.uri,
        new Range(doc.positionAt(0,), doc.positionAt(original.length,),),
        rewritten,
      );
      const applied = await workspace.applyEdit(edit,);
      if (!applied) {
        const result = failure("language edit was not applied",);
        showFailure(result,);
        return result;
      }
      getViews()?.refresh();
      window.showInformationMessage(
        `SyntaxMesh: language set to ${pick.label}.`,
      );
      return success({ uri: doc.uri.toString(), language: pick.label, },);
    },),);

  registry.register("syntaxmesh.showProjectTree", () =>
    guardedCommand(
      true,
      async () => {
        getViews()?.refresh();
        await commands.executeCommand("syntaxmesh.projectTree.focus",);
        return success(null,);
      },
      (message,) => window.showErrorMessage(message,),
    ),);

  registry.register("syntaxmesh.openManual", () =>
    guardedCommand(
      true,
      async () => {
        const pick = await window.showQuickPick(
          getManualToc().map((entry,) => ({
            label: entry.title,
            description: entry.id,
            id: entry.id,
          })),
          { placeHolder: "Select a manual page", matchOnDescription: true, },
        );
        if (pick === undefined) {
          return failure("manual page selection cancelled",);
        }
        const page = getManualPage(pick.id,) ?? "";
        const panel = window.createWebviewPanel(
          "syntaxmeshManual",
          `SyntaxMesh Manual: ${pick.label}`,
          ViewColumn.Beside,
          { enableScripts: false, },
        );
        panel.webview.html = manualPageHtml(pick.label, page,);
        return success({ id: pick.id, title: pick.label, },);
      },
      (message,) => window.showErrorMessage(message,),
    ),);

  registry.register(
    "syntaxmesh.help",
    () =>
      trusted(async (): Promise<CommandResult<ExecutionResult>> => {
        const envelope = await helpCommand(metadata,);
        const specs = envelope.results.help;
        if (!envelope.ok || specs === undefined) {
          const result = failure("help is unavailable", envelope.messages,);
          showFailure(result,);
          return result;
        }
        helpOutput.clear();
        helpOutput.appendLine(formatHelp(specs,),);
        helpOutput.show(ViewColumn.Active, true,);
        return { ok: true, value: envelope, messages: envelope.messages, };
      },),
  );

  registry.register(
    "syntaxmesh.version",
    () =>
      trusted(async (): Promise<CommandResult<ExecutionResult>> => {
        const envelope = await versionCommand(metadata,);
        const version = envelope.results.version;
        if (!envelope.ok || version === undefined) {
          const result = failure("version is unavailable", envelope.messages,);
          showFailure(result,);
          return result;
        }
        window.showInformationMessage(`${version.name} ${version.version}`,);
        return { ok: true, value: envelope, messages: envelope.messages, };
      },),
  );

  registry.register(
    "syntaxmesh.man",
    (
      format?: string,
      keywords?: string[],
      targetUri?: string,
      color?: boolean,
    ) =>
      trusted(async () => {
        let selectedFormat = format;
        if (selectedFormat === undefined) {
          selectedFormat = await window.showQuickPick(
            ["text", "html", "smx",],
            { placeHolder: "Select manual format", },
          );
        }
        if (selectedFormat === undefined) {
          return failure("manual format selection cancelled",);
        }

        if (selectedFormat === "html" && targetUri === undefined) {
          const selected = await window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: "Select Manual Output Directory",
          },);
          const directory = selected?.[0];
          if (directory === undefined) {
            return failure("manual output directory selection cancelled",);
          }
          targetUri = directory.toString();
        }

        const result = await withBusy(() =>
          executeMan({
            format: selectedFormat as ManFormat,
            keywords,
            targetUri,
            color,
          }, { execute: metadata.execute, output, },)
        );
        if (!result.ok) {
          const detail = result.messages.find((message,) =>
            message.severity === "error"
          )?.text;
          window.showErrorMessage(`SyntaxMesh: ${detail ?? result.error}`,);
          return result;
        }

        if (result.value.artifacts.length > 0) {
          window.showInformationMessage(
            `SyntaxMesh: wrote ${result.value.artifacts.length} manual file(s).`,
          );
        } else {
          manualOutput.clear();
          manualOutput.append(result.value.stdout,);
          manualOutput.show(ViewColumn.Active, true,);
        }
        return result;
      },),
  );
}
