/**
 * Shared Desktop/Web command registrar (22.12.19).
 *
 * One activation creates one service, diagnostics host and output-channel set over
 * the supplied daemon/output/console adapters. Every public command is registered
 * exactly once before runtime-only compatibility aliases are added.
 */
import { commands, window, workspace, } from "vscode";
import type { ExtensionContext, OutputChannel, } from "vscode";
import type { ConfirmedOutputHost, } from "../cli/output-host.ts";
import type { DaemonHost, } from "../daemon/host.ts";
import {
  type ExecutionDiagnosticsHost,
  startExecutionDiagnostics,
} from "../diagnostics/host.ts";
import type { ReportPresenter, } from "../reports/host.ts";
import { withBusy, } from "../views/host.ts";
import type { WriteStrategy, } from "../web/write-fallback.ts";
import type { CommandExecutor, } from "./aliases.ts";
import {
  type CommandResult,
  type ConsoleAdapter,
  type ExecutionCommandService,
} from "./contracts.ts";
import { registerProjectGroup, } from "./daemon.ts";
import { commandPort, readText, registerExecutionGroup, } from "./execution.ts";
import { registerMiscGroup, } from "./misc.ts";
import { registerCommandSet, } from "./registration-core.ts";
import { registerReportGroup, } from "./reports.ts";
import { ProjectService, } from "./service.ts";
import { activeMasterUri, } from "./shared.ts";
import { registerConsoleGroup, } from "../console/register.ts";

/** Host-specific inputs for one canonical command-registration pass. */
export interface CommandRegistrationOptions {
  /** Started project daemon shared by every command group. */
  host: DaemonHost;
  /** HTML report presenter using the same confirmed output host. */
  presenter: ReportPresenter;
  /** Confirmed output host created once by the activation entry. */
  output: ConfirmedOutputHost;
  /** User-triggered write strategy: Desktop direct or Web stub-first. */
  writeStrategy: WriteStrategy;
  /** Active Desktop PTY or Web input-console adapter. */
  console: ConsoleAdapter;
}

/** Shared dependencies consumed by all canonical command groups. */
export interface CanonicalCommandDependencies {
  /** Started project daemon. */
  host: DaemonHost;
  /** Isolated execution-diagnostic collection. */
  diagnostics: ExecutionDiagnosticsHost;
  /** Single UI-free project/execution/report service. */
  service: ExecutionCommandService;
  /** HTML report presenter. */
  presenter: ReportPresenter;
  /** Shared confirmed output host. */
  output: ConfirmedOutputHost;
  /** User-triggered write strategy. */
  writeStrategy: WriteStrategy;
  /** Active console adapter. */
  console: ConsoleAdapter;
  /** Sheet command renderer output. */
  sheetOutput: OutputChannel;
  /** Help command renderer output. */
  helpOutput: OutputChannel;
  /** Manual command renderer output. */
  manualOutput: OutputChannel;
  /** Resolves and, when needed, loads one project through the shared service. */
  resolveProject(
    explicit?: string,
    reportFailure?: boolean,
  ): Promise<string | undefined>;
}

/** Creates one output channel and ties its lifetime to the extension context. */
function outputChannel(
  context: ExtensionContext,
  name: string,
): OutputChannel {
  const channel = window.createOutputChannel(name,);
  context.subscriptions.push(channel,);
  return channel;
}

/**
 * Registers the complete canonical API and runtime-only compatibility commands.
 *
 * @param context extension lifetime for diagnostics, channels, commands and console.
 * @param options started daemon and host-specific output/console adapters.
 */
export function registerCanonicalCommands(
  context: ExtensionContext,
  options: CommandRegistrationOptions,
): void {
  const diagnostics = startExecutionDiagnostics(context,);
  const service = new ProjectService(commandPort(options.host,), readText,);
  const sheetOutput = outputChannel(context, "SyntaxMesh Sheets",);
  const helpOutput = outputChannel(context, "SyntaxMesh Help",);
  const manualOutput = outputChannel(context, "SyntaxMesh Manual",);
  const resolveProject = async (
    explicit?: string,
    reportFailure = true,
  ): Promise<string | undefined> => {
    let resolved: CommandResult<string>;
    if (explicit !== undefined) {
      resolved = service.resolveProject(explicit,);
    } else {
      const activeRegistry = options.host.core.activeProject()?.uri;
      const activeDocument = activeMasterUri()?.toString();
      if (activeRegistry !== undefined) {
        resolved = service.resolveProject(activeRegistry,);
      } else if (activeDocument !== undefined) {
        resolved = service.resolveProject(activeDocument,);
      } else {
        resolved = service.resolveProject();
      }
    }
    if (!resolved.ok) {
      if (reportFailure) {
        window.showErrorMessage(`SyntaxMesh: ${resolved.error}`,);
      }
      return undefined;
    }
    const uri = resolved.value;
    if (options.host.core.cache.has(uri,)) return uri;
    const loaded = await withBusy(() => service.addProject(uri,));
    if (!loaded.ok) {
      if (reportFailure) {
        window.showErrorMessage(`SyntaxMesh: ${loaded.error}`,);
      }
      return undefined;
    }
    return uri;
  };
  const shared: CanonicalCommandDependencies = {
    host: options.host,
    diagnostics,
    service,
    presenter: options.presenter,
    output: options.output,
    writeStrategy: options.writeStrategy,
    console: options.console,
    sheetOutput,
    helpOutput,
    manualOutput,
    resolveProject,
  };
  const executor: CommandExecutor = {
    async execute<T,>(id: string, ...args: unknown[]): Promise<T> {
      return await commands.executeCommand<T>(id, ...args,);
    },
  };

  registerCommandSet({
    registrar: commands,
    context,
    shared,
    groups: {
      project: registerProjectGroup,
      execution: registerExecutionGroup,
      report: registerReportGroup,
      misc: registerMiscGroup,
      console: (registry, dependencies,) =>
        registerConsoleGroup(registry, dependencies.console,),
    },
    executor,
    console: options.console,
    legacyOverrides: {
      "syntaxmesh.generateReport": () => {
        const defaultFormat = workspace.getConfiguration("syntaxmesh",)
          .get<string>("report.defaultFormat", "html",);
        return defaultFormat === "html"
          ? commands.executeCommand("syntaxmesh.report.open",)
          : commands.executeCommand(
            "syntaxmesh.report.export",
            undefined,
            undefined,
            defaultFormat,
          );
      },
    },
  },);
}
