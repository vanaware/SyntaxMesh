/**
 * Project-free manual command service (22.12.12).
 *
 * The core owns manual generation. This module validates the current F24 format
 * surface, forwards keywords/color and applies the extension's explicit output
 * policy: text/SMX stay on stdout unless given a file, while HTML writes its
 * complete file map under one selected directory.
 */
import type { ExecutionRequest, ExecutionResult, } from "@vanaware/syntaxmesh";
import type {
  ConfirmedOutputHost,
  ConfirmedWriteOptions,
} from "../cli/output-host.ts";
import type { ArtifactResult, CommandResult, } from "./contracts.ts";
import type { MetaExecutionPort, } from "./meta.ts";

/** Current manual formats accepted by F24. */
export type ManFormat = "text" | "html" | "smx";

/** Options for one project-free manual request. */
export interface ManCommandOptions {
  /** Defaults to `text`; the stale `tjp` format is rejected. */
  format?: ManFormat;
  /** Manual keywords/sections to render. */
  keywords?: string[];
  /** File URI for text/SMX or directory URI for HTML. */
  targetUri?: string;
  /** Enables ANSI color in textual manual output. */
  color?: boolean;
}

/** Successful manual execution and its explicit output. */
export interface ManCommandResult {
  /** Unmodified core execution envelope. */
  execution: ExecutionResult;
  /** Files written by the confirmed output host, in production order. */
  artifacts: ArtifactResult[];
  /** Text/SMX content when no file target was supplied. */
  stdout: string;
}

/** Project-free execution plus shared confirmed output. */
export interface ManCommandPort extends MetaExecutionPort {
  /** Shared preflighted output host. */
  output: ConfirmedOutputHost;
}

/** Converts an unknown failure into the command failure contract. */
function failure(error: unknown,): CommandResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error,),
    messages: [],
  };
}

/** Runtime format guard; callers may cross untyped command boundaries. */
function isManFormat(value: string,): value is ManFormat {
  return value === "text" || value === "html" || value === "smx";
}

/** Parses an absolute target URI without touching the filesystem. */
function targetUrl(uri: string,): URL {
  let parsed: URL;
  try {
    parsed = new URL(uri,);
  } catch {
    throw new Error(`manual target must be an absolute URI: ${uri}`,);
  }
  if (parsed.protocol === "") {
    throw new Error(`manual target must be an absolute URI: ${uri}`,);
  }
  return parsed;
}

/** Splits a file URI into its parent directory and decoded basename. */
function splitFileTarget(uri: string,): { root: string; fileName: string } {
  const parsed = targetUrl(uri,);
  const path = parsed.pathname.replace(/\/$/, "",);
  const index = path.lastIndexOf("/",);
  const encodedName = path.slice(index + 1,);
  if (encodedName === "") {
    throw new Error("manual file target must include a file name",);
  }
  const fileName = decodeURIComponent(encodedName,);
  parsed.pathname = index <= 0 ? "/" : path.slice(0, index + 1,);
  parsed.search = "";
  parsed.hash = "";
  return { root: parsed.toString(), fileName, };
}

/**
 * Executes one manual request and applies explicit output when requested.
 *
 * @param options format, keywords, color and optional destination.
 * @param port injected core execution and confirmed output host.
 * @param policy optional per-invocation output confirmation override.
 * @returns the envelope and successful output, or a structured failure.
 */
export async function executeMan(
  options: ManCommandOptions,
  port: ManCommandPort,
  policy?: ConfirmedWriteOptions,
): Promise<CommandResult<ManCommandResult>> {
  const format = options.format ?? "text";
  if (!isManFormat(format,)) {
    return failure(
      `unsupported manual format: ${format}; expected text, html or smx`,
    );
  }
  if (format === "html" && options.targetUri === undefined) {
    return failure("HTML manual output requires a target directory",);
  }

  try {
    const target = options.targetUri === undefined
      ? undefined
      : targetUrl(options.targetUri,);
    const request: ExecutionRequest = {
      man: {
        format,
        ...(options.keywords === undefined ? {} : {
          keywords: [...options.keywords,],
        }),
        ...(options.color === undefined ? {} : { color: options.color, }),
      },
    };
    if (format === "html" && options.targetUri !== undefined) {
      request.outputDir = options.targetUri;
    }

    const execution = await port.execute(request,);
    if (!execution.ok) {
      return {
        ok: false,
        error: "manual execution failed",
        messages: execution.messages,
      };
    }
    const man = execution.results.man;
    if (man === undefined) {
      return {
        ok: false,
        error: "manual execution returned no manual section",
        messages: execution.messages,
      };
    }

    if (format !== "html") {
      if (target === undefined) {
        return {
          ok: true,
          value: { execution, artifacts: [], stdout: man.content, },
          messages: execution.messages,
        };
      }
      const destination = splitFileTarget(target.toString(),);
      const written = await port.output.writeAll(
        [{
          path: destination.fileName,
          content: man.content,
          kind: "manual",
        },],
        destination.root,
        policy,
      );
      if (!written.ok) return { ...written, messages: execution.messages, };
      if (written.value.length !== 1) {
        return {
          ok: false,
          error: "manual output returned no artifact",
          messages: execution.messages,
        };
      }
      return {
        ok: true,
        value: { execution, artifacts: written.value, stdout: "", },
        messages: execution.messages,
      };
    }

    const dispatched = await port.output.dispatch(execution, policy,);
    if (!dispatched.ok) return { ...dispatched, messages: execution.messages, };
    return {
      ok: true,
      value: {
        execution,
        artifacts: dispatched.value.artifacts,
        stdout: dispatched.value.stdout,
      },
      messages: execution.messages,
    };
  } catch (error) {
    return failure(error,);
  }
}
