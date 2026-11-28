/**
 * Project-free metadata command services (22.12.11).
 *
 * Help and version are execution-envelope requests, not project operations:
 * each handler sends exactly one flag-only request and returns the envelope
 * unchanged. The host supplies the engine through {@link MetaExecutionPort}.
 */
import type { ExecutionRequest, ExecutionResult, } from "@vanaware/syntaxmesh";

/** Minimal execution boundary required by metadata commands. */
export interface MetaExecutionPort {
  /**
   * Executes one plain-data request.
   *
   * @param request the complete core execution request.
   * @returns the unmodified execution envelope.
   */
  execute(request: ExecutionRequest,): Promise<ExecutionResult>;
}

/**
 * Requests the structured help section without opening a project.
 *
 * @param port injected execution engine.
 * @returns the core help envelope.
 */
export function helpCommand(
  port: MetaExecutionPort,
): Promise<ExecutionResult> {
  return port.execute({ help: true, },);
}

/**
 * Requests package version metadata without opening a project.
 *
 * @param port injected execution engine.
 * @returns the core version envelope.
 */
export function versionCommand(
  port: MetaExecutionPort,
): Promise<ExecutionResult> {
  return port.execute({ version: true, },);
}
