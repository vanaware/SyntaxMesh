/**
 * In-process `syntaxmesh.run` adapter (22.12.14).
 *
 * The shared CLI parser remains the single argv authority. This module only
 * resolves host paths, routes the parsed request through semantic services and
 * applies the extension's confirmed output policy; it never starts a process or
 * constructs a second execution engine.
 */
import type {
  ExecutionRequest,
  ExecutionResult,
  ExecutionSheetAppOptions,
  SheetAppName,
} from "@vanaware/syntaxmesh";
import type {
  ParseArgsOptions,
  ParsedArgs,
} from "@vanaware/syntaxmesh-cli/options";
import { Reporter, } from "@vanaware/syntaxmesh-cli/reporter";
import type {
  ConfirmedOutputHost,
  ConfirmedWriteOptions,
} from "../cli/output-host.ts";
import type { BuildRequestOptions, } from "../daemon/request-builder.ts";
import type { ProjectModel, } from "../daemon/types.ts";
import type { LoadedConfig, } from "./config.ts";
import type { ArtifactResult, CommandResult, } from "./contracts.ts";
import { formatHelp, } from "./help-text.ts";
import { type ManCommandOptions, type ManCommandResult, } from "./manual.ts";
import { helpCommand, versionCommand, } from "./meta.ts";
import { resolveProjectUri, } from "./project-ref.ts";
import type {
  SheetCommandOptions,
  SheetCommandResult,
  SheetEmailAppName,
} from "./sheets.ts";

/** Host and renderer context for one in-process CLI-compatible invocation. */
export interface Tj3RunContext {
  /** URI string used to resolve argv paths and relative output. */
  cwd?: string;
  /** Receiver input when `--from -` is selected. */
  stdin?: string;
  /** Allows a bare sheet command to use the host's selected project. */
  useActiveProject?: boolean;
  /** Per-invocation overwrite confirmation override. */
  confirmOverwrite?: (paths: string[],) => Promise<boolean>;
  /** Host renderer defaults combined with the parsed CLI renderer options. */
  renderer?: { silent?: boolean; color?: boolean };
}

/** Successful run output plus the unmodified execution envelope. */
export interface Tj3RunResult {
  execution: ExecutionResult;
  artifacts: ArtifactResult[];
  stdout: string;
  stderr: string;
}

/** Injectable parser, semantic services and host operations for one run. */
export interface Tj3RunPort {
  parseArgs(argv: readonly string[], options?: ParseArgsOptions,): ParsedArgs;
  resolve(path: string,): string;
  read(path: string,): Promise<string>;
  loadConfig(uri: string,): Promise<CommandResult<LoadedConfig>>;
  hasProject(uri: string,): boolean;
  addProject(uri: string,): Promise<CommandResult<ProjectModel>>;
  refreshProject(uri: string,): Promise<CommandResult<ProjectModel>>;
  resolveActiveProject(): Promise<string | undefined>;
  executeProject(
    uri: string,
    options: BuildRequestOptions,
  ): Promise<CommandResult<ExecutionResult>>;
  executeRequest(request: ExecutionRequest,): Promise<ExecutionResult>;
  executeMan(
    options: ManCommandOptions,
    policy?: ConfirmedWriteOptions,
  ): Promise<CommandResult<ManCommandResult>>;
  executeSheetApp(
    app: SheetEmailAppName,
    projectUri: string | undefined,
    options: SheetCommandOptions,
    stdin?: string,
    policy?: ConfirmedWriteOptions,
  ): Promise<CommandResult<SheetCommandResult>>;
  output: ConfirmedOutputHost;
}

/** Converts an arbitrary thrown value into the command failure contract. */
function failure(error: unknown,): CommandResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error,),
    messages: [],
  };
}

/** Whether the parsed app is one of the five project-backed email apps. */
function isSheetEmailApp(
  app: SheetAppName | undefined,
): app is SheetEmailAppName {
  return app === "ts-send" || app === "ts-receive" || app === "ts-summary" ||
    app === "ss-send" || app === "ss-receive";
}

/** Resolves one argv path against the invocation cwd or master directory. */
function resolveRunPath(
  path: string,
  context: Tj3RunContext,
  port: Tj3RunPort,
  masterDir?: string,
): string {
  const cwd = context.cwd ?? masterDir;
  if (cwd === undefined) return port.resolve(path,);
  const base = cwd.endsWith("/",) ? cwd : `${cwd}/`;
  return port.resolve(new URL(path, base,).toString(),);
}

/**
 * Executes one `syntaxmesh.run` argv through the shared parser and F24 services.
 *
 * @param argv complete CLI-compatible argument vector.
 * @param context host path, input and renderer context.
 * @param port injected parser, semantic operations and confirmed output host.
 * @returns the execution envelope, artifacts and captured renderer output.
 */
export async function runTj3(
  argv: readonly string[],
  context: Tj3RunContext,
  port: Tj3RunPort,
): Promise<CommandResult<Tj3RunResult>> {
  let parsed: ParsedArgs;
  try {
    parsed = port.parseArgs(argv, {
      allowMissingSheetEntry: context.useActiveProject === true,
    },);
  } catch (error) {
    return failure(error,);
  }

  const silent = parsed.renderer.silent || context.renderer?.silent === true;
  const color = parsed.renderer.color && context.renderer?.color !== false;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const reporter = new Reporter({
    silent,
    color,
    out: (line,) => stdoutLines.push(line,),
    err: (line,) => stderrLines.push(line,),
  },);
  const stderrText = (): string =>
    stderrLines.length === 0 ? "" : `${stderrLines.join("\n",)}\n`;
  const outputPolicy = context.confirmOverwrite === undefined
    ? undefined
    : { confirmOverwrite: context.confirmOverwrite, };

  try {
    if (parsed.request.help === true || parsed.request.version === true) {
      const execution = parsed.request.help === true
        ? await helpCommand({ execute: port.executeRequest, },)
        : await versionCommand({ execute: port.executeRequest, },);
      reporter.report(execution.messages,);
      const dispatched = await port.output.dispatch(execution, {
        ...(context.cwd === undefined ? {} : { cwd: context.cwd, }),
        ...(context.confirmOverwrite === undefined
          ? {}
          : { confirmOverwrite: context.confirmOverwrite, }),
      },);
      if (!dispatched.ok) return dispatched;
      const stdout = parsed.request.help === true
        ? dispatched.value.stdout +
          `${formatHelp(execution.results.help ?? [],)}\n`
        : dispatched.value.stdout;
      return {
        ok: true,
        value: {
          execution,
          artifacts: dispatched.value.artifacts,
          stdout,
          stderr: stderrText(),
        },
        messages: execution.messages,
      };
    }

    if (parsed.request.man !== undefined) {
      const man = parsed.request.man;
      const targetUri = man.format !== "html"
        ? undefined
        : parsed.request.outputDir === undefined
        ? context.cwd ?? port.resolve("",)
        : resolveRunPath(parsed.request.outputDir, context, port,);
      const manual = await port.executeMan({
        format: man.format,
        ...(man.keywords === undefined
          ? {}
          : { keywords: [...man.keywords,], }),
        color,
        ...(targetUri === undefined ? {} : { targetUri, }),
      }, outputPolicy,);
      if (!manual.ok) return manual;
      reporter.report(manual.value.execution.messages,);
      return {
        ok: true,
        value: {
          execution: manual.value.execution,
          artifacts: manual.value.artifacts,
          stdout: manual.value.stdout,
          stderr: stderrText(),
        },
        messages: manual.value.execution.messages,
      };
    }

    if (isSheetEmailApp(parsed.request.app,)) {
      let uri: string;
      if (parsed.request.entry !== undefined) {
        uri = resolveRunPath(parsed.request.entry, context, port,);
      } else if (context.useActiveProject === true) {
        const active = await port.resolveActiveProject();
        if (active === undefined) return failure("no project master selected",);
        uri = active;
      } else {
        return failure("sheet app requires a positional project master",);
      }
      const masterDir = new URL(".", uri,).toString();
      const resolved = resolveProjectUri({ explicit: uri, projects: [], },);
      if (!resolved.ok) return resolved;
      const loaded = port.hasProject(uri,)
        ? await port.refreshProject(uri,)
        : await port.addProject(uri,);
      if (!loaded.ok) return loaded;

      const appOptions: ExecutionSheetAppOptions = parsed.request.appOptions ??
        {};
      const options: SheetCommandOptions = {
        ...(parsed.sheetDir === null ? {} : {
          directoryUri: resolveRunPath(
            parsed.sheetDir,
            context,
            port,
            masterDir,
          ),
        }),
        ...(typeof appOptions.endDate === "string"
          ? { endDate: appOptions.endDate, }
          : {}),
        ...(appOptions.resources === undefined
          ? {}
          : { resources: [...appOptions.resources,], }),
        ...(appOptions.force === undefined ? {} : { force: appOptions.force, }),
        ...(typeof appOptions.hideResource === "string"
          ? { hideResource: appOptions.hideResource, }
          : {}),
        ...(typeof appOptions.intervalDuration === "string"
          ? { intervalDuration: appOptions.intervalDuration, }
          : {}),
        ...(appOptions.dryRun === undefined
          ? {}
          : { dryRun: appOptions.dryRun, }),
        ...(appOptions.sheetRecipients === undefined
          ? {}
          : { sheetRecipients: [...appOptions.sheetRecipients,], }),
        ...(appOptions.digestRecipients === undefined
          ? {}
          : { digestRecipients: [...appOptions.digestRecipients,], }),
        ...(parsed.configFile === null ? {} : {
          configUri: resolveRunPath(
            parsed.configFile,
            context,
            port,
            masterDir,
          ),
        }),
        ...(parsed.messageFile === null ? {} : {
          fromUri: parsed.messageFile === "-"
            ? "-"
            : resolveRunPath(parsed.messageFile, context, port, masterDir,),
        }),
      };
      const sheet = await port.executeSheetApp(
        parsed.request.app,
        uri,
        options,
        parsed.request.app === "ts-receive" ||
          parsed.request.app === "ss-receive"
          ? context.stdin
          : undefined,
        outputPolicy,
      );
      if (!sheet.ok) return sheet;
      reporter.report(sheet.value.execution.messages,);
      return {
        ok: true,
        value: {
          execution: sheet.value.execution,
          artifacts: sheet.value.artifacts,
          stdout: sheet.value.stdout,
          stderr: stderrText(),
        },
        messages: sheet.value.execution.messages,
      };
    }

    if (parsed.request.entry !== undefined) {
      const uri = resolveRunPath(parsed.request.entry, context, port,);
      const masterDir = new URL(".", uri,).toString();
      const resolved = resolveProjectUri({ explicit: uri, projects: [], },);
      if (!resolved.ok) return resolved;
      const options: BuildRequestOptions = {
        ...(parsed.request.checkSyntax === undefined
          ? {}
          : { checkSyntax: parsed.request.checkSyntax, }),
        ...(parsed.request.listReports === undefined
          ? {}
          : { listReports: parsed.request.listReports, }),
        ...(parsed.request.listReportsIsRegex === undefined
          ? {}
          : { listReportsIsRegex: parsed.request.listReportsIsRegex, }),
        ...(parsed.request.report === undefined
          ? {}
          : { report: parsed.request.report, }),
        ...(parsed.request.reportsIsRegex === undefined
          ? {}
          : { reportsIsRegex: parsed.request.reportsIsRegex, }),
        ...(parsed.request.dynamicAttributes === undefined
          ? {}
          : { dynamicAttributes: parsed.request.dynamicAttributes, }),
        ...(parsed.request.noReports === undefined
          ? {}
          : { noReports: parsed.request.noReports, }),
        ...(parsed.request.forceReports === undefined
          ? {}
          : { forceReports: parsed.request.forceReports, }),
        ...(parsed.request.abortOnWarnings === undefined
          ? {}
          : { abortOnWarnings: parsed.request.abortOnWarnings, }),
        ...(parsed.request.warnTsDeltas === undefined
          ? {}
          : { warnTsDeltas: parsed.request.warnTsDeltas, }),
        ...(parsed.request.addTrace === undefined
          ? {}
          : { addTrace: parsed.request.addTrace, }),
        ...(parsed.request.freeze === undefined
          ? {}
          : { freeze: parsed.request.freeze, }),
      };
      if (parsed.configFile !== null) {
        const config = await port.loadConfig(
          resolveRunPath(parsed.configFile, context, port, masterDir,),
        );
        if (!config.ok) return config;
        options.configContent = config.value.configContent;
        options.configObject = config.value.configObject;
      }
      if (parsed.request.outputDir !== undefined) {
        options.outputDir = resolveRunPath(
          parsed.request.outputDir,
          context,
          port,
          masterDir,
        );
      }
      if (
        parsed.request.app === "check-ts" || parsed.request.app === "check-ss"
      ) {
        if (parsed.sheetFile === null) {
          return failure(`${parsed.request.app} requires a sheet file`,);
        }
        const sheetUri = resolveRunPath(
          parsed.sheetFile,
          context,
          port,
          masterDir,
        );
        options.app = parsed.request.app;
        options.appOptions = {
          sheetContent: await port.read(sheetUri,),
          sheetFile: sheetUri,
        };
      }
      const loaded = port.hasProject(uri,)
        ? await port.refreshProject(uri,)
        : await port.addProject(uri,);
      if (!loaded.ok) return loaded;
      const executed = await port.executeProject(uri, options,);
      if (!executed.ok) return executed;
      reporter.report(executed.value.messages,);
      const dispatched = await port.output.dispatch(executed.value, {
        cwd: context.cwd ?? masterDir,
        ...(context.confirmOverwrite === undefined
          ? {}
          : { confirmOverwrite: context.confirmOverwrite, }),
      },);
      if (!dispatched.ok) return dispatched;
      return {
        ok: true,
        value: {
          execution: executed.value,
          artifacts: dispatched.value.artifacts,
          stdout: dispatched.value.stdout,
          stderr: stderrText(),
        },
        messages: executed.value.messages,
      };
    }

    return failure("unsupported run request",);
  } catch (error) {
    return failure(error,);
  }
}
