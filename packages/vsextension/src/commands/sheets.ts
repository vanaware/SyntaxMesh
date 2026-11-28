/**
 * UI-free semantic commands for the five phase-18 sheet apps (22.12.13).
 *
 * The host supplies project selection, file reads and confirmed output. This
 * module hydrates the F24 data contract, including the four sheet trees, and
 * returns file/email artifacts without introducing SMTP or a second execution
 * entry point.
 */
import type {
  ExecutionMessage,
  ExecutionResult,
  ExecutionSheetAppOptions,
} from "@vanaware/syntaxmesh";
import { collectSheetFiles, } from "@vanaware/syntaxmesh-cli/sheet-files";
import { formatMessage, } from "@vanaware/syntaxmesh-cli/reporter";
import type {
  ConfirmedOutputHost,
  ConfirmedWriteOptions,
} from "../cli/output-host.ts";
import type { BuildRequestOptions, } from "../daemon/request-builder.ts";
import { loadConfig, } from "./config.ts";
import type { ArtifactResult, CommandResult, } from "./contracts.ts";

/** Caller options for one sheet-app command. */
export interface SheetCommandOptions {
  /** Read/write root; defaults to the resolved master's parent directory. */
  directoryUri?: string;
  /** Upper bound of the period being processed. */
  endDate?: string;
  /** Resource ids selected by sender and summary apps. */
  resources?: string[];
  /** Re-send an already existing template. */
  force?: boolean;
  /** Resource expression hidden by the status-sheet sender. */
  hideResource?: string;
  /** Period interval for the status-sheet sender. */
  intervalDuration?: string;
  /** Recipients appended to both summary recipient lists. */
  to?: string[];
  /** Recipients of individual time sheets. */
  sheetRecipients?: string[];
  /** Recipients of the consolidated time-sheet digest. */
  digestRecipients?: string[];
  /** Preview the app without writing files or email artifacts. */
  dryRun?: boolean;
  /** YAML configuration file URI. */
  configUri?: string;
  /** Receiver message file URI, or `-` for injected stdin. */
  fromUri?: string;
}

/** Successful sheet execution plus confirmed output data. */
export interface SheetCommandResult {
  /** Unexpanded execution envelope returned by the core. */
  execution: ExecutionResult;
  /** Real sheet and outbox destinations. */
  artifacts: ArtifactResult[];
  /** Printable report, summary or email text. */
  stdout: string;
  /** Structured execution messages in CLI-compatible form. */
  stderr: string;
}

/** The five email sheet apps exposed by the extension. */
export type SheetEmailAppName =
  | "ts-send"
  | "ts-receive"
  | "ts-summary"
  | "ss-send"
  | "ss-receive";

/** Host operations required by the pure sheet command service. */
export interface SheetCommandPort {
  /** Resolves an explicit, active-editor or single loaded project. */
  resolveProject(
    explicit?: string,
  ): CommandResult<string> | Promise<CommandResult<string>>;
  /** Executes one request over the resolved cached project. */
  executeProject(
    uri: string,
    options: BuildRequestOptions,
  ): Promise<ExecutionResult>;
  /** Reads one UTF-8 file or open buffer. */
  read(uri: string,): Promise<string>;
  /** Lists one directory in discovery order. */
  listDir(uri: string,): Promise<string[]>;
  /** Reports whether one URI is a directory. */
  isDir(uri: string,): Promise<boolean>;
  /** Preflights and dispatches F24 output. */
  output: ConfirmedOutputHost;
}

/** Converts a thrown value into the command failure contract. */
function failure(error: unknown,): CommandResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error,),
    messages: [],
  };
}

/** Whether the selected app consumes a raw email message. */
function isReceiver(app: SheetEmailAppName,): boolean {
  return app === "ts-receive" || app === "ss-receive";
}

/** Resolves the default sheet root beside one master URI. */
function masterDirectory(uri: string,): string {
  return new URL(".", uri,).toString();
}

/** Formats execution messages for the stderr side of the command result. */
function stderrText(messages: readonly ExecutionMessage[],): string {
  if (messages.length === 0) return "";
  return `${messages.map((message,) => formatMessage(message,)).join("\n",)}\n`;
}

/** Removes write-producing sheet data while preserving printable preview text. */
function previewExecution(execution: ExecutionResult,): ExecutionResult {
  const sheet = execution.results.sheet;
  if (sheet === undefined) return execution;
  return {
    ...execution,
    results: {
      ...execution.results,
      sheet: { ...sheet, files: [], emails: [], },
    },
  };
}

/**
 * Resolves, hydrates and executes one sheet app over a cached project.
 *
 * @param app semantic sheet app name.
 * @param projectUri optional explicit project master URI.
 * @param options typed command options supplied by a host adapter.
 * @param port project, file and output operations supplied by the host.
 * @param stdin optional receiver message supplied by a run/console context.
 * @param policy optional per-invocation output confirmation override.
 * @returns the execution and confirmed output, or a structured failure.
 */
export async function executeSheetApp(
  app: SheetEmailAppName,
  projectUri: string | undefined,
  options: SheetCommandOptions,
  port: SheetCommandPort,
  stdin?: string,
  policy?: ConfirmedWriteOptions,
): Promise<CommandResult<SheetCommandResult>> {
  try {
    const resolved = await port.resolveProject(projectUri,);
    if (!resolved.ok) return resolved;

    const directoryUri = options.directoryUri ??
      masterDirectory(resolved.value,);
    const appOptions: ExecutionSheetAppOptions = {};
    if (options.endDate !== undefined) appOptions.endDate = options.endDate;
    if (options.resources !== undefined) {
      appOptions.resources = [...options.resources,];
    }
    if (options.force !== undefined) appOptions.force = options.force;
    if (options.hideResource !== undefined) {
      appOptions.hideResource = options.hideResource;
    }
    if (options.intervalDuration !== undefined) {
      appOptions.intervalDuration = options.intervalDuration;
    }
    if (options.dryRun !== undefined) appOptions.dryRun = options.dryRun;

    if (options.sheetRecipients !== undefined || options.to !== undefined) {
      appOptions.sheetRecipients = [
        ...(options.sheetRecipients ?? []),
        ...(options.to ?? []),
      ];
    }
    if (options.digestRecipients !== undefined || options.to !== undefined) {
      appOptions.digestRecipients = [
        ...(options.digestRecipients ?? []),
        ...(options.to ?? []),
      ];
    }

    let configContent: string | undefined;
    if (options.configUri !== undefined) {
      const config = await loadConfig(options.configUri, port.read,);
      if (!config.ok) return config;
      configContent = config.value.configContent;
      appOptions.config = config.value.configObject;
    }

    if (isReceiver(app,)) {
      let rawMessage: string | undefined;
      if (options.fromUri !== undefined && options.fromUri !== "-") {
        rawMessage = await port.read(options.fromUri,);
      } else {
        rawMessage = stdin;
      }
      if (rawMessage === undefined) {
        return failure(
          options.fromUri === "-"
            ? `${app} requires injected stdin for fromUri '-'`
            : `${app} requires an email message file or injected stdin`,
        );
      }
      appOptions.rawMessage = rawMessage;
    } else if (options.fromUri !== undefined) {
      return failure("fromUri only applies to receiver sheet apps",);
    }

    const files = await collectSheetFiles(directoryUri, port,);
    if (files.length > 0) appOptions.files = files;

    const request: BuildRequestOptions = { app, appOptions, };
    if (configContent !== undefined) request.configContent = configContent;
    const execution = await port.executeProject(resolved.value, request,);
    if (!execution.ok) {
      return {
        ok: false,
        error: "sheet execution failed",
        messages: execution.messages,
      };
    }

    const dispatched = await port.output.dispatch(
      options.dryRun === true ? previewExecution(execution,) : execution,
      { sheetBaseDir: directoryUri, ...(policy ?? {}), },
    );
    if (!dispatched.ok) return { ...dispatched, messages: execution.messages, };
    return {
      ok: true,
      value: {
        execution,
        artifacts: dispatched.value.artifacts,
        stdout: dispatched.value.stdout,
        stderr: stderrText(execution.messages,),
      },
      messages: execution.messages,
    };
  } catch (error) {
    return failure(error,);
  }
}
