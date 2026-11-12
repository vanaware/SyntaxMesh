/**
 * `diagnostics.ts` — engine messages as LSP diagnostics (22.1.8).
 *
 * Projects the `Message[]` of an analysis onto the protocol shapes of
 * `vscode-languageserver-types` (types only). Positions convert from the
 * engine's 1-based `SourceFileInfo` to the protocol's 0-based line/character;
 * `info`/`debug` messages are not diagnostics and stay out.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (toDiagnostics)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import type { Diagnostic, } from "./types.ts";
import type { AnalysisResult, } from "./analyze.ts";

/** `DiagnosticSeverity.Error` (literal keeps the module runtime-free). */
const SEVERITY_ERROR = 1;
/** `DiagnosticSeverity.Warning`. */
const SEVERITY_WARNING = 2;

/**
 * Converts the messages of an analysis into LSP diagnostics.
 *
 * `fatal`/`error` become `Error`, `warning` becomes `Warning`; the range is a
 * zero-width marker at the reported position (the engine reports points, not
 * spans). Messages without `sourceFileInfo` land at the start of the file.
 * v1 texts are already English — no translation happens here.
 *
 * @param analysis result of {@link analyzeDocument}.
 * @returns one diagnostic per error/warning message, in recording order.
 */
export function toDiagnostics(analysis: AnalysisResult,): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const message of analysis.messages) {
    if (message.type === "info" || message.type === "debug") continue;
    const sfi = message.sourceFileInfo;
    const line = sfi === null ? 0 : Math.max(0, sfi.lineNo - 1,);
    const character = sfi === null ? 0 : Math.max(0, sfi.columnNo - 1,);
    diagnostics.push({
      range: {
        start: { line, character, },
        end: { line, character, },
      },
      severity: message.type === "warning" ? SEVERITY_WARNING : SEVERITY_ERROR,
      code: message.id,
      source: "syntaxmesh",
      message: message.message,
    },);
  }
  return diagnostics;
}
