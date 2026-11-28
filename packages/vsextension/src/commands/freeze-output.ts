/**
 * Freeze output command (22.12.10). The core returns header and bookings as
 * data; this module validates their names and writes both beside the master in
 * one confirmed batch.
 */
import type { ExecutionResult, } from "@vanaware/syntaxmesh";
import type {
  ArtifactResult,
  CommandResult,
  ExecutionCommandOptions,
} from "./contracts.ts";
import type { ConfirmedOutputHost, } from "../cli/output-host.ts";

/** Successful freeze output data returned only after both writes complete. */
export interface FreezeCommandResult {
  execution: ExecutionResult;
  artifacts: ArtifactResult[];
}

/** Project selection and core freeze options. */
export interface FreezeOutputOptions {
  projectUri: string;
  freezeDate?: string;
  byTask?: boolean;
  options?: ExecutionCommandOptions;
}

/** Core execution and confirmed output operations required by freeze. */
export interface FreezeOutputPort {
  freeze(
    uri: string,
    freezeDate?: string,
    byTask?: boolean,
    options?: ExecutionCommandOptions,
  ): Promise<CommandResult<ExecutionResult>>;
  output: ConfirmedOutputHost;
}

const ABSOLUTE_URI = /^[A-Za-z][A-Za-z\d+.-]*:/;

/** Validates one core freeze name and returns its basename. */
function freezeBasename(name: string,): string {
  if (
    name === "" || name === "." || ABSOLUTE_URI.test(name,) ||
    name.startsWith("/",) || name.includes("\\",) || name.includes("\0",) ||
    name.includes("/",) || name.split("/",).includes("..",)
  ) {
    throw new Error(
      `SyntaxMesh: freeze path must be a safe file name: ${name}`,
    );
  }
  return name;
}

/** Structured freeze failure carrying the execution messages unchanged. */
function failure(
  error: unknown,
  messages: ExecutionResult["messages"],
): CommandResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error,),
    messages,
  };
}

/** Executes freeze and writes its two artifacts beside the project master. */
export async function freezeOutput(
  options: FreezeOutputOptions,
  port: FreezeOutputPort,
): Promise<CommandResult<FreezeCommandResult>> {
  const executed = await port.freeze(
    options.projectUri,
    options.freezeDate,
    options.byTask,
    options.options,
  );
  if (!executed.ok) return executed;

  const execution = executed.value;
  const files = execution.results.freeze?.files;
  if (!execution.ok || files === undefined || files.length !== 2) {
    return failure(
      "SyntaxMesh: freeze did not produce two files.",
      execution.messages,
    );
  }

  try {
    const approvedRoot = new URL(".", options.projectUri,).toString();
    const writes = files.map((file,) => ({
      path: freezeBasename(file.fileName,),
      content: file.contents,
      kind: "freeze" as const,
    }));
    const written = await port.output.writeAll(writes, approvedRoot,);
    if (!written.ok) return { ...written, messages: execution.messages, };
    if (written.value.length !== 2) {
      return failure(
        "SyntaxMesh: freeze output returned an incomplete artifact list.",
        execution.messages,
      );
    }
    return {
      ok: true,
      value: { execution, artifacts: written.value, },
      messages: execution.messages,
    };
  } catch (error) {
    return failure(error, execution.messages,);
  }
}
