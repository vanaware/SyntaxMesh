/**
 * Pure allowlisted dispatcher for the shared SyntaxMesh console core (22.12.15).
 *
 * The dispatcher owns only request-to-command mapping and result presentation. It
 * never imports an editor API, starts a process or constructs a command id from
 * console input; hosts inject the canonical command executor.
 */
import type {
  ExecutionMessage,
  ExecutionResult,
  ListReportsEntry,
} from "@vanaware/syntaxmesh";
import { formatMessage, } from "@vanaware/syntaxmesh-cli/reporter";
import type { CommandResult, } from "../commands/contracts.ts";
import type { FreezeCommandResult, } from "../commands/freeze-output.ts";
import { formatHelp, } from "../commands/help-text.ts";
import type { ReportExportResult, } from "../commands/service.ts";
import type { SheetCommandResult, } from "../commands/sheets.ts";
import type { Tj3RunContext, Tj3RunResult, } from "../commands/run.ts";
import type { ProjectModel, ProjectSummary, } from "../daemon/types.ts";
import {
  formatExecutionResult,
  formatProjectList,
  formatReportList,
  formatRunResult,
  formatSheetResult,
} from "./formatter.ts";
import type { ConsoleRequest, } from "./parser.ts";

/** Host boundary implemented by the Desktop/Web command adapter. */
export interface ConsoleCommandExecutor {
  execute<T,>(id: string, ...args: unknown[]): Promise<T>;
}

/** Formatted output or one local console control action. */
export type ConsoleDispatchResult =
  | { kind: "output"; ok: boolean; text: string }
  | { kind: "clear" }
  | { kind: "exit" };

/** Recognizes the structured command failure/success contract. */
function isCommandResult(value: unknown,): value is CommandResult<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.ok === "boolean" &&
    ("value" in candidate || "error" in candidate) &&
    Array.isArray(candidate.messages,);
}

/** Accepts canonical wrapped results and the spec's raw utility results. */
function unwrap<T,>(value: unknown,): CommandResult<T> {
  if (isCommandResult(value,)) return value as CommandResult<T>;
  return { ok: true, value: value as T, messages: [], };
}

/** Creates one successful console output result with a final newline. */
function output(text: string,): ConsoleDispatchResult {
  return {
    kind: "output",
    ok: true,
    text: text === "" || text.endsWith("\n",) ? text : `${text}\n`,
  };
}

/** Renders a command failure and any structured messages as console errors. */
function failure(
  error: unknown,
  messages: readonly ExecutionMessage[] = [],
): ConsoleDispatchResult {
  const detail = error instanceof Error ? error.message : String(error,);
  const lines = [`Error: ${detail}`,];
  if (messages.length > 0) {
    lines.push("Messages:",);
    for (const message of messages) {
      lines.push(`  ${formatMessage(message,)}`,);
    }
  }
  return { kind: "output", ok: false, text: `${lines.join("\n",)}\n`, };
}

/** Executes one fixed command id and formats its unwrapped successful value. */
async function execute<T,>(
  executor: ConsoleCommandExecutor,
  id: string,
  args: unknown[],
  render: (value: T,) => string,
): Promise<ConsoleDispatchResult> {
  const result = unwrap<T>(await executor.execute<unknown>(id, ...args,),);
  if (!result.ok) return failure(result.error, result.messages,);
  return output(render(result.value,),);
}

/** Formats a successful project mutation notice. */
function projectNotice(
  action: "add" | "refresh" | "setActive",
  project: ProjectModel,
): string {
  if (action === "setActive") {
    return `Active project: ${project.entry} (${project.uri}).\n`;
  }
  return `${action === "add" ? "Loaded" : "Refreshed"} ` +
    `${project.entry} (${project.status}).\n`;
}

/** Dispatches one project request through its explicit canonical id. */
function dispatchProject(
  request: Extract<ConsoleRequest, { kind: "project" }>,
  executor: ConsoleCommandExecutor,
): Promise<ConsoleDispatchResult> {
  switch (request.action) {
    case "list":
      return execute<ProjectSummary[]>(
        executor,
        "syntaxmesh.project.list",
        [],
        formatProjectList,
      );
    case "remove":
      return execute<null>(
        executor,
        "syntaxmesh.project.remove",
        [request.project,],
        () => `Removed project: ${request.project ?? "(active)"}.\n`,
      );
    case "add":
      return execute<ProjectModel>(
        executor,
        "syntaxmesh.project.add",
        [request.project,],
        (project,) => projectNotice("add", project,),
      );
    case "refresh":
      return execute<ProjectModel>(
        executor,
        "syntaxmesh.project.refresh",
        [request.project,],
        (project,) => projectNotice("refresh", project,),
      );
    case "setActive":
      return execute<ProjectModel>(
        executor,
        "syntaxmesh.project.setActive",
        [request.project,],
        (project,) => projectNotice("setActive", project,),
      );
  }
}

/** Dispatches compile/check/schedule/freeze through their canonical commands. */
function dispatchExecution(
  request: Extract<ConsoleRequest, { kind: "execute" }>,
  executor: ConsoleCommandExecutor,
): Promise<ConsoleDispatchResult> {
  switch (request.action) {
    case "compile":
      return execute<ExecutionResult>(
        executor,
        "syntaxmesh.compile",
        [request.project, request.options,],
        formatExecutionResult,
      );
    case "checkSyntax":
      return execute<ExecutionResult>(
        executor,
        "syntaxmesh.checkSyntax",
        [request.project, request.options,],
        formatExecutionResult,
      );
    case "scheduleOnly":
      return execute<ExecutionResult>(
        executor,
        "syntaxmesh.scheduleOnly",
        [request.project, request.options,],
        formatExecutionResult,
      );
    case "freeze":
      return execute<FreezeCommandResult>(
        executor,
        "syntaxmesh.freeze",
        [
          request.project,
          request.freezeDate,
          request.byTask,
          request.options,
        ],
        (result,) => formatExecutionResult(result.execution,),
      );
  }
}

/** Dispatches sheet checks and the five email apps with their real signatures. */
function dispatchSheet(
  request: Extract<ConsoleRequest, { kind: "sheet" }>,
  executor: ConsoleCommandExecutor,
): Promise<ConsoleDispatchResult> {
  switch (request.action) {
    case "checkTimeSheet":
      return execute<ExecutionResult>(
        executor,
        "syntaxmesh.checkTimeSheet",
        [request.project, request.sheet, request.options,],
        formatExecutionResult,
      );
    case "checkStatusSheet":
      return execute<ExecutionResult>(
        executor,
        "syntaxmesh.checkStatusSheet",
        [request.project, request.sheet, request.options,],
        formatExecutionResult,
      );
    case "timeSend":
      return sheetEmail("syntaxmesh.sheet.time.send", request, executor,);
    case "timeReceive":
      return sheetEmail("syntaxmesh.sheet.time.receive", request, executor,);
    case "timeSummary":
      return sheetEmail("syntaxmesh.sheet.time.summary", request, executor,);
    case "statusSend":
      return sheetEmail("syntaxmesh.sheet.status.send", request, executor,);
    case "statusReceive":
      return sheetEmail("syntaxmesh.sheet.status.receive", request, executor,);
  }
}

/** Maps a receiver sheet path into options and preserves injected-stdin boundary. */
function sheetEmail(
  id: string,
  request: Extract<ConsoleRequest, { kind: "sheet" }>,
  executor: ConsoleCommandExecutor,
): Promise<ConsoleDispatchResult> {
  const options = { ...request.options, };
  if (
    (request.action === "timeReceive" || request.action === "statusReceive") &&
    request.sheet !== undefined
  ) {
    options.fromUri = request.sheet;
  }
  return execute<SheetCommandResult>(
    executor,
    id,
    [request.project, options, undefined,],
    formatSheetResult,
  );
}

/** Dispatches report inventory, rendering, opening and explicit export. */
function dispatchReport(
  request: Extract<ConsoleRequest, { kind: "report" }>,
  executor: ConsoleCommandExecutor,
): Promise<ConsoleDispatchResult> {
  switch (request.action) {
    case "list":
      return execute<ListReportsEntry[]>(
        executor,
        "syntaxmesh.report.list",
        [request.project, request.pattern,],
        formatReportList,
      );
    case "render":
      return execute<ExecutionResult>(
        executor,
        "syntaxmesh.report.render",
        [
          request.project,
          request.report,
          request.reportsIsRegex,
          request.dynamicAttributes,
        ],
        formatExecutionResult,
      );
    case "open":
      return execute<null>(
        executor,
        "syntaxmesh.report.open",
        [request.project, request.report, request.dynamicAttributes,],
        () => `Opened report: ${request.report ?? "(selected)"}.\n`,
      );
    case "export":
      return execute<ReportExportResult>(
        executor,
        "syntaxmesh.report.export",
        [
          request.project,
          request.report,
          request.format,
          request.dynamicAttributes,
          request.target,
        ],
        (result,) =>
          `Exported report: ${request.report ?? "(selected)"} -> ` +
          `${result.artifact.fileName}.\n`,
      );
  }
}

/**
 * Dispatches one typed console request through the fixed canonical allowlist.
 *
 * @param request parsed console request; user text is never treated as a command id.
 * @param executor host-supplied canonical command executor.
 * @param context optional run path/input context forwarded only to `syntaxmesh.run`.
 * @returns formatted output or a local clear/exit control action.
 */
export async function dispatchConsoleRequest(
  request: ConsoleRequest,
  executor: ConsoleCommandExecutor,
  context: Tj3RunContext = {},
): Promise<ConsoleDispatchResult> {
  try {
    switch (request.kind) {
      case "project":
        return await dispatchProject(request, executor,);
      case "execute":
        return await dispatchExecution(request, executor,);
      case "sheet":
        return await dispatchSheet(request, executor,);
      case "report":
        return await dispatchReport(request, executor,);
      case "run": {
        const runContext: Tj3RunContext = { ...context, };
        if (request.stdin !== undefined) runContext.stdin = request.stdin;
        if (request.useActiveProject === true) {
          runContext.useActiveProject = true;
        }
        return await execute<Tj3RunResult>(
          executor,
          "syntaxmesh.run",
          [request.argv, runContext,],
          formatRunResult,
        );
      }
      case "help":
        return await execute<ExecutionResult>(
          executor,
          "syntaxmesh.help",
          [],
          (result,) => `${formatHelp(result.results.help ?? [],)}\n`,
        );
      case "version":
        return await execute<ExecutionResult>(
          executor,
          "syntaxmesh.version",
          [],
          (result,) => {
            const version = result.results.version;
            return version === undefined
              ? "Version unavailable.\n"
              : `${version.name} ${version.version}\n`;
          },
        );
      case "clear":
        return { kind: "clear", };
      case "exit":
        return { kind: "exit", };
      default:
        return failure("unsupported console request",);
    }
  } catch (error) {
    return failure(error,);
  }
}
