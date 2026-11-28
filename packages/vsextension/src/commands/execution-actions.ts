/** Host-free presentation boundary for canonical execution command results. */
import type { ExecutionMessage, ExecutionResult, } from "@vanaware/syntaxmesh";
import type { CommandResult, } from "./contracts.ts";
import { assertTrusted, } from "../trust.ts";

/** Runs one trust-gated action and preserves failures as command data. */
export async function guardedCommand<T,>(
  isTrusted: boolean,
  action: () => Promise<CommandResult<T>>,
  showError: (message: string,) => void,
): Promise<CommandResult<T>> {
  try {
    assertTrusted(isTrusted,);
    return await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error,);
    showError(
      message.startsWith("SyntaxMesh: ",) ? message : `SyntaxMesh: ${message}`,
    );
    return { ok: false, error: message, messages: [], };
  }
}

/** Preserves a structured result or converts an omitted cancellation to failure. */
export function commandResultOrFailure<T,>(
  result: CommandResult<T> | undefined,
  cancellation: string,
): CommandResult<T> {
  return result ?? { ok: false, error: cancellation, messages: [], };
}

/** UI effects required after one semantic execution command completes. */
export interface ExecutionResultPresentation {
  showError(message: string,): void;
  publish(uri: string, messages: ExecutionMessage[],): void;
  refresh(): void;
}

/**
 * Publishes one execution envelope and returns the original command result.
 *
 * @param masterUri project master used to resolve diagnostic source paths.
 * @param result structured service result returned to programmatic callers.
 * @param presentation host-owned diagnostics, messages and view refresh.
 * @returns the same result object, preserving console and command API identity.
 */
export function presentExecutionResult(
  masterUri: string,
  result: CommandResult<ExecutionResult>,
  presentation: ExecutionResultPresentation,
): CommandResult<ExecutionResult> {
  if (!result.ok) {
    presentation.showError(`SyntaxMesh: ${result.error}`,);
    return result;
  }
  presentation.publish(masterUri, result.value.messages,);
  if (!result.value.ok) {
    presentation.showError("SyntaxMesh: execution failed.",);
  }
  presentation.refresh();
  return result;
}
