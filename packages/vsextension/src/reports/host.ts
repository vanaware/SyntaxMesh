/**
 * `reports/host.ts` — report presentation bootstrap (22.6.4).
 *
 * Materializes the output policy (22.6.1) over the VS Code API: HTML reports
 * open in a Webview panel (assets served as `vscode-webview-resource:` URIs,
 * strict CSP, a Save button that posts back here), every other format is
 * written next to the master with `workspace.fs.writeFile`. All decisions live
 * in the pure policy/selector/renderer; this file only wires I/O (ADR 035).
 *
 * Imports the `vscode` runtime, so it is type-checked here and exercised inside
 * VS Code (acceptance deferred to P7). The bundled `assets/` tree (css/scripts/
 * icons) is copied into the package at packaging time (P7).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.3 (reports)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.6.4
 */
import { Uri, ViewColumn, window, workspace, } from "vscode";
import type { ExtensionContext, Webview, } from "vscode";
import type { ReportJsonEntry, } from "@vanaware/syntaxmesh";
import { destinationFor, reportFileName, } from "./output-policy.ts";
import { renderWebviewHtml, } from "./webview-html.ts";

/** Asset paths an HTML report may reference (relative to `assets/`). */
const ASSET_PATHS = [
  "css/tjreport.css",
  "css/tjmanual.css",
  "scripts/wz_tooltip.js",
];

/** A random CSP nonce for one Webview panel. */
function nonce(): string {
  return crypto.randomUUID().replace(/-/g, "",);
}

/**
 * Presents generated reports: HTML in a Webview, other formats saved to disk.
 * One instance per extension activation (holds the asset root).
 */
export class ReportPresenter {
  private readonly context: ExtensionContext;

  /**
   * @param context the extension context (resolves the bundled `assets/`).
   */
  constructor(context: ExtensionContext,) {
    this.context = context;
  }

  /**
   * Presents one rendered report format according to the output policy.
   *
   * @param entry the generated report entry (name + formats).
   * @param format the chosen format id (22.6.2).
   * @param content the rendered content of that format.
   * @param masterUri URI of the master document (save destination root).
   */
  async present(
    entry: ReportJsonEntry,
    format: string,
    content: string,
    masterUri: Uri,
  ): Promise<void> {
    if (destinationFor(format,) === "webview") {
      this.showWebview(entry.name, content, masterUri,);
      return;
    }
    await this.save(entry.name, format, content, masterUri,);
  }

  /** Opens the HTML report in a Webview panel beside the editor. */
  private showWebview(name: string, content: string, masterUri: Uri,): void {
    const assetsRoot = Uri.file(this.context.asAbsolutePath("assets",),);
    const panel = window.createWebviewPanel(
      "syntaxmeshReport",
      `SyntaxMesh: ${name}`,
      ViewColumn.Beside,
      { enableScripts: true, localResourceRoots: [assetsRoot,], },
    );
    const assets = this.assetMap(panel.webview,);
    panel.webview.html = renderWebviewHtml(
      content,
      assets,
      panel.webview.cspSource,
      nonce(),
    );
    panel.webview.onDidReceiveMessage(
      async (message: { command?: string },) => {
        if (message.command === "save") {
          await this.save(name, "html", content, masterUri,);
        }
      },
    );
  }

  /** Maps each bundled asset path to its Webview resource URI. */
  private assetMap(webview: Webview,): Record<string, string> {
    const map: Record<string, string> = {};
    for (const path of ASSET_PATHS) {
      const disk = Uri.file(this.context.asAbsolutePath(`assets/${path}`,),);
      map[path] = webview.asWebviewUri(disk,).toString();
    }
    return map;
  }

  /** Writes a report next to the master document and confirms it. */
  private async save(
    name: string,
    format: string,
    content: string,
    masterUri: Uri,
  ): Promise<void> {
    const fileName = reportFileName(name, format,);
    const target = Uri.joinPath(masterUri, "..", fileName,);
    await workspace.fs.writeFile(target, new TextEncoder().encode(content,),);
    window.showInformationMessage(`SyntaxMesh: saved ${fileName}.`,);
  }
}
