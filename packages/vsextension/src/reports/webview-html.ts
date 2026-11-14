/**
 * `reports/webview-html.ts` — pure Webview document renderer (22.6.3).
 *
 * Wraps a generated HTML report in a Webview-safe document: a strict Content
 * Security Policy bound to the Webview's `cspSource`, asset references rewritten
 * to `vscode-webview-resource:` URIs (the host converts them with
 * `webview.asWebviewUri` and passes the map), and a small Save button that posts
 * a message back to the extension. Pure string transformation — no `vscode`
 * runtime, unit-testable in Deno.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.3 (reports)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.6.3
 */

/**
 * Inline script of the Save button. Kept as a constant (no interpolation) so it
 * is emitted verbatim under the CSP nonce; it posts `{command:"save"}` to the
 * extension host, which writes the report to the workspace.
 */
const SAVE_SCRIPT = `const vscode = acquireVsCodeApi();` +
  `document.getElementById("smx-save").addEventListener("click", () => {` +
  `vscode.postMessage({ command: "save" });` +
  `});`;

/**
 * Renders the Webview document for an HTML report.
 *
 * @param content the generated report HTML (references assets by relative path).
 * @param assets map of relative asset path → Webview resource URI (host-built).
 * @param cspSource the Webview's `cspSource` (allowed resource origin).
 * @param nonce CSP nonce for the inline Save script; the host passes a random
 *   value per panel (the default is only for deterministic tests).
 * @returns the full HTML document to assign to `webview.html`.
 */
export function renderWebviewHtml(
  content: string,
  assets: Record<string, string>,
  cspSource: string,
  nonce = "syntaxmesh-report",
): string {
  let body = content;
  for (const [path, uri,] of Object.entries(assets,)) {
    body = body.replaceAll(path, uri,);
  }
  const csp = `default-src 'none'; ` +
    `style-src ${cspSource} 'unsafe-inline'; ` +
    `script-src ${cspSource} 'nonce-${nonce}'; ` +
    `img-src ${cspSource} data:; ` +
    `font-src ${cspSource};`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SyntaxMesh Report</title>
</head>
<body>
<div class="smx-toolbar"><button id="smx-save" type="button">Save</button></div>
${body}
<script nonce="${nonce}">${SAVE_SCRIPT}</script>
</body>
</html>
`;
}
