/**
 * Pure projection of F24 execution messages into editor-neutral diagnostics.
 * The VS Code collection host consumes this data without changing message
 * order, source metadata or stable message ids.
 */
import type { ExecutionMessage, } from "@vanaware/syntaxmesh";

/** One execution message projected to the extension diagnostic contract. */
export interface ExecutionDiagnostic {
  /** Source path exactly as reported, or `null` when unknown. */
  file: string | null;
  /** One-based source line exactly as reported, or `null` when unknown. */
  line: number | null;
  /** Editor-facing severity; fatal and error share the error level. */
  severity: "error" | "warning" | "information" | "hint";
  /** Rendered message text. */
  message: string;
  /** Stable TaskJuggler message id. */
  code: string;
}

/** Editor-neutral zero-based range for one execution diagnostic. */
export interface ExecutionDiagnosticRange {
  /** Zero-based start line. */
  startLine: number;
  /** Zero-based start character. */
  startCharacter: number;
  /** Zero-based end line. */
  endLine: number;
  /** Zero-based end character. */
  endCharacter: number;
}

/**
 * Resolves a message source against the master directory.
 *
 * Explicit URI schemes remain unchanged; absolute paths retain the master URI's
 * scheme and authority. Messages without a file are attached to the master.
 */
export function resolveExecutionDiagnosticUri(
  masterUri: string,
  file: string | null,
): string {
  if (file === null) return masterUri;
  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(file,)) return file;
  return new URL(file, new URL("./", masterUri,),).toString();
}

/** Converts a one-based message line to a zero-based editor range. */
export function executionDiagnosticRange(
  line: number | null,
): ExecutionDiagnosticRange {
  const zeroBased = line === null ? 0 : Math.max(0, line - 1,);
  return {
    startLine: zeroBased,
    startCharacter: 0,
    endLine: zeroBased,
    endCharacter: 0,
  };
}

/** Projects execution messages without inventing missing source locations. */
export function projectExecutionDiagnostics(
  messages: ExecutionMessage[],
): ExecutionDiagnostic[] {
  return messages.map((message,) => ({
    file: message.file,
    line: message.line,
    severity: message.severity === "fatal" || message.severity === "error"
      ? "error"
      : message.severity === "warning"
      ? "warning"
      : message.severity === "info"
      ? "information"
      : "hint",
    message: message.text,
    code: message.id,
  }));
}
