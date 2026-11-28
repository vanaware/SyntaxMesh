/**
 * `diagnostics/host.ts` — isolated execution diagnostics (22.12.6).
 *
 * Owns only the `syntaxmesh.execution` VS Code collection. The language client
 * continues to own its LSP diagnostics; this host never clears or replaces that
 * collection. Pure message, URI and range projections live in `execution.ts`.
 */
import { Diagnostic, DiagnosticSeverity, languages, Range, Uri, } from "vscode";
import type {
  DiagnosticCollection,
  Disposable,
  ExtensionContext,
} from "vscode";
import type { ExecutionMessage, } from "@vanaware/syntaxmesh";
import {
  type ExecutionDiagnostic,
  executionDiagnosticRange,
  projectExecutionDiagnostics,
  resolveExecutionDiagnosticUri,
} from "./execution.ts";

/** VS Code diagnostic collection name dedicated to F24 execution messages. */
export const EXECUTION_DIAGNOSTIC_COLLECTION = "syntaxmesh.execution";

/** Editor severities keyed by the UI-free projection contract. */
const SEVERITIES: Record<ExecutionDiagnostic["severity"], DiagnosticSeverity> =
  {
    error: DiagnosticSeverity.Error,
    warning: DiagnosticSeverity.Warning,
    information: DiagnosticSeverity.Information,
    hint: DiagnosticSeverity.Hint,
  };

/**
 * Publishes execution diagnostics without touching LSP-owned diagnostics.
 * Published resource URIs are tracked per master so one project's reload or
 * removal does not clear another project's execution diagnostics.
 */
export class ExecutionDiagnosticsHost implements Disposable {
  /** The extension-owned collection disposed with the extension context. */
  private readonly collection: DiagnosticCollection;
  /** Resource URIs last published for each master URI. */
  private readonly published = new Map<string, string[]>();

  /** Creates the single extension-owned execution diagnostic collection. */
  constructor() {
    this.collection = languages.createDiagnosticCollection(
      EXECUTION_DIAGNOSTIC_COLLECTION,
    );
  }

  /**
   * Replaces one project's execution diagnostics with a fresh envelope.
   *
   * @param masterUri master document URI used to resolve relative sources.
   * @param messages messages from the completed F24 execution envelope.
   */
  publish(masterUri: string, messages: ExecutionMessage[],): void {
    const grouped = new Map<string, Diagnostic[]>();
    for (const projected of projectExecutionDiagnostics(messages,)) {
      const target = resolveExecutionDiagnosticUri(
        masterUri,
        projected.file,
      );
      const location = executionDiagnosticRange(projected.line,);
      const diagnostic = new Diagnostic(
        new Range(
          location.startLine,
          location.startCharacter,
          location.endLine,
          location.endCharacter,
        ),
        projected.message,
        SEVERITIES[projected.severity],
      );
      diagnostic.source = EXECUTION_DIAGNOSTIC_COLLECTION;
      diagnostic.code = projected.code;
      const existing = grouped.get(target,);
      if (existing === undefined) grouped.set(target, [diagnostic,],);
      else existing.push(diagnostic,);
    }

    this.clearProject(masterUri,);
    for (const [target, diagnostics,] of grouped) {
      this.collection.set(Uri.parse(target,), diagnostics,);
    }
    this.published.set(masterUri, [...grouped.keys(),],);
  }

  /**
   * Clears only execution diagnostics previously published for one project.
   *
   * @param masterUri master document URI whose diagnostics should be removed.
   */
  clearProject(masterUri: string,): void {
    const targets = this.published.get(masterUri,);
    if (targets === undefined) return;
    for (const target of targets) this.collection.delete(Uri.parse(target,),);
    this.published.delete(masterUri,);
  }

  /** Disposes the extension-owned collection and forgets its URI index. */
  dispose(): void {
    this.collection.dispose();
    this.published.clear();
  }
}

/**
 * Creates the execution diagnostic host and ties its lifetime to the extension.
 *
 * @param context the extension context owning the collection disposable.
 * @returns the host shared by daemon and semantic execution commands.
 */
export function startExecutionDiagnostics(
  context: ExtensionContext,
): ExecutionDiagnosticsHost {
  const created = new ExecutionDiagnosticsHost();
  context.subscriptions.push(created,);
  return created;
}
