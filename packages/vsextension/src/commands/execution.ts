/**
 * Canonical execution command group shared by Desktop and Web (22.12.19).
 *
 * The group adapts project selection, file reads, diagnostics and messages to the
 * shared service/output hosts. Every console-visible handler returns its real
 * structured result instead of discarding it after presentation.
 */
import { FileType, Uri, window, workspace, } from "vscode";
import type { ExecutionResult, } from "@vanaware/syntaxmesh";
import { parseArgs, } from "@vanaware/syntaxmesh-cli/options";
import type { DaemonHost, } from "../daemon/host.ts";
import type { BuildRequestOptions, } from "../daemon/request-builder.ts";
import { getViews, withBusy, } from "../views/host.ts";
import { loadConfig, } from "./config.ts";
import type {
  CommandResult,
  ExecutionCommandOptions,
  ExecutionCommandPort,
} from "./contracts.ts";
import {
  type ExecutionResultPresentation,
  guardedCommand,
  presentExecutionResult,
} from "./execution-actions.ts";
import { freezeOutput, } from "./freeze-output.ts";
import { executeMan, } from "./manual.ts";
import type { CanonicalCommandDependencies, } from "./register.ts";
import type { CommandRegistry, } from "./registry.ts";
import { runTj3, type Tj3RunContext, type Tj3RunPort, } from "./run.ts";
import {
  executeSheetApp,
  type SheetCommandOptions,
  type SheetCommandPort,
  type SheetEmailAppName,
} from "./sheets.ts";

/** Reads a URI as text, preferring an open unsaved document over disk. */
export async function readText(uri: string,): Promise<string> {
  const target = Uri.parse(uri,);
  const open = workspace.textDocuments.find((document,) =>
    document.uri.toString() === target.toString()
  );
  if (open !== undefined) return open.getText();
  return new TextDecoder().decode(await workspace.fs.readFile(target,),);
}

/** Adapts the VS Code daemon host to the synchronous/async service port. */
export function commandPort(host: DaemonHost,): ExecutionCommandPort {
  return {
    addProject: (uri,) => host.addProject(uri,),
    refreshProject: (uri,) => host.reloadProject(uri,),
    removeProject: (uri,) => host.removeProject(uri,),
    listProjects: () => host.core.listProjects(),
    setActiveProject: (uri,) => host.setActiveProject(uri,),
    activeProject: () => host.core.activeProject(),
    listReports: (uri,) => host.core.listReports(uri,),
    executeProject: (uri, options,) => host.core.executeProject(uri, options,),
  };
}

/** Prompts for one sheet file when the command did not receive an explicit URI. */
async function chooseSheet(label: string,): Promise<string | undefined> {
  const selected = await window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    openLabel: label,
  },);
  return selected?.[0]?.toString();
}

/** Lists one sheet directory through the host filesystem. */
async function listSheetDirectory(uri: string,): Promise<string[]> {
  const entries = await workspace.fs.readDirectory(Uri.parse(uri,),);
  return entries.map(([name,],) => name);
}

/** Reports whether one sheet-tree URI is a directory. */
async function isSheetDirectory(uri: string,): Promise<boolean> {
  try {
    const stat = await workspace.fs.stat(Uri.parse(uri,),);
    return stat.type === FileType.Directory;
  } catch {
    return false;
  }
}

/** Registers every canonical execution, run and sheet command exactly once. */
export function registerExecutionGroup(
  registry: CommandRegistry,
  dependencies: CanonicalCommandDependencies,
): void {
  const { host, diagnostics, service, output, sheetOutput, } = dependencies;
  const presentation: ExecutionResultPresentation = {
    showError: (message,) => window.showErrorMessage(message,),
    publish: (uri, messages,) => diagnostics.publish(uri, messages,),
    refresh: () => getViews()?.refresh(),
  };
  const executeLoadedProject = async (
    uri: string,
    options: BuildRequestOptions,
  ): Promise<ExecutionResult> => {
    if (!host.core.cache.has(uri,)) {
      const loaded = await service.addProject(uri,);
      if (!loaded.ok) throw new Error(loaded.error,);
    }
    const result = await service.executeProject(uri, options,);
    if (!result.ok) throw new Error(result.error,);
    return result.value;
  };
  const sheetPort: SheetCommandPort = {
    resolveProject: async (explicit,) => {
      const uri = await dependencies.resolveProject(explicit, false,);
      return uri === undefined
        ? { ok: false, error: "no project master selected", messages: [], }
        : { ok: true, value: uri, messages: [], };
    },
    executeProject: executeLoadedProject,
    read: readText,
    listDir: listSheetDirectory,
    isDir: isSheetDirectory,
    output,
  };
  const runPort: Tj3RunPort = {
    parseArgs,
    resolve: (path,) => output.resolve(path,),
    read: readText,
    loadConfig: (uri,) => loadConfig(uri, readText,),
    hasProject: (uri,) => host.core.cache.has(uri,),
    addProject: (uri,) => service.addProject(uri,),
    refreshProject: (uri,) => service.refreshProject(uri,),
    resolveActiveProject: () => dependencies.resolveProject(undefined, false,),
    executeProject: (uri, options,) => service.executeProject(uri, options,),
    executeRequest: (request,) => host.core.executeRequest(request,),
    executeMan: (options, policy,) =>
      executeMan(options, {
        execute: (request,) => host.core.executeRequest(request,),
        output,
      }, policy,),
    executeSheetApp: (app, project, options, stdin, policy,) =>
      executeSheetApp(app, project, options, sheetPort, stdin, policy,),
    output,
  };
  const withProject = <T,>(
    explicit: string | undefined,
    action: (uri: string,) => Promise<CommandResult<T>>,
  ): Promise<CommandResult<T>> =>
    guardedCommand(
      workspace.isTrusted,
      () =>
        withBusy(async (): Promise<CommandResult<T>> => {
          const uri = await dependencies.resolveProject(explicit,);
          if (uri === undefined) {
            return {
              ok: false,
              error: "no project master selected",
              messages: [],
            };
          }
          return await action(uri,);
        },),
      presentation.showError,
    );
  const registerSheet = (id: string, app: SheetEmailAppName,): void => {
    registry.register(
      id,
      (
        project?: string,
        options: SheetCommandOptions = {},
        stdin?: string,
      ) =>
        guardedCommand(
          workspace.isTrusted,
          () =>
            withBusy(async () => {
              const result = await executeSheetApp(
                app,
                project,
                options,
                sheetPort,
                stdin,
              );
              if (!result.ok) {
                presentation.showError(`SyntaxMesh: ${result.error}`,);
                return result;
              }
              if (result.value.stdout !== "" || result.value.stderr !== "") {
                sheetOutput.clear();
                sheetOutput.append(result.value.stdout,);
                sheetOutput.append(result.value.stderr,);
                sheetOutput.show(true,);
              }
              if (result.value.artifacts.length > 0) {
                window.showInformationMessage(
                  `SyntaxMesh: wrote ${result.value.artifacts.length} sheet file(s).`,
                );
              }
              return result;
            },),
          presentation.showError,
        ),
    );
  };

  registry.register(
    "syntaxmesh.run",
    (argv: readonly string[] = [], context: Tj3RunContext = {},) =>
      guardedCommand(
        workspace.isTrusted,
        async () => {
          const result = await withBusy(() => runTj3(argv, context, runPort,));
          if (!result.ok) {
            presentation.showError(`SyntaxMesh: ${result.error}`,);
          }
          return result;
        },
        presentation.showError,
      ),
  );
  registry.register(
    "syntaxmesh.compile",
    (project?: string, options?: ExecutionCommandOptions,) =>
      withProject(project, async (uri,) =>
        presentExecutionResult(
          uri,
          await service.compile(uri, options,),
          presentation,
        ),),
  );
  registry.register(
    "syntaxmesh.checkSyntax",
    (project?: string, options?: ExecutionCommandOptions,) =>
      withProject(project, async (uri,) =>
        presentExecutionResult(
          uri,
          await service.checkSyntax(uri, options,),
          presentation,
        ),),
  );
  registry.register(
    "syntaxmesh.scheduleOnly",
    (project?: string, options?: ExecutionCommandOptions,) =>
      withProject(project, async (uri,) =>
        presentExecutionResult(
          uri,
          await service.scheduleOnly(uri, options,),
          presentation,
        ),),
  );
  registry.register(
    "syntaxmesh.freeze",
    (
      project?: string,
      freezeDate?: string,
      byTask?: boolean,
      options?: ExecutionCommandOptions,
    ) =>
      withProject(project, async (uri,) => {
        const result = await freezeOutput({
          projectUri: uri,
          freezeDate,
          byTask,
          options,
        }, {
          freeze: (project, date, grouped, executionOptions,) =>
            service.freeze(project, date, grouped, executionOptions,),
          output,
        },);
        const execution: CommandResult<ExecutionResult> = result.ok
          ? {
            ok: true,
            value: result.value.execution,
            messages: result.messages,
          }
          : result;
        presentExecutionResult(uri, execution, presentation,);
        if (result.ok) {
          window.showInformationMessage(
            `SyntaxMesh: saved ${
              result.value.artifacts.map((artifact,) => artifact.fileName)
                .join(", ",)
            }.`,
          );
        }
        return result;
      },),
  );
  registry.register(
    "syntaxmesh.checkTimeSheet",
    (project?: string, sheet?: string, options?: ExecutionCommandOptions,) =>
      withProject(project, async (uri,) => {
        const sheetUri = sheet ?? await chooseSheet("Select time sheet",);
        if (sheetUri === undefined) {
          return {
            ok: false,
            error: "time sheet selection cancelled",
            messages: [],
          };
        }
        return presentExecutionResult(
          uri,
          await service.checkTimeSheet(uri, sheetUri, options,),
          presentation,
        );
      },),
  );
  registry.register(
    "syntaxmesh.checkStatusSheet",
    (project?: string, sheet?: string, options?: ExecutionCommandOptions,) =>
      withProject(project, async (uri,) => {
        const sheetUri = sheet ?? await chooseSheet("Select status sheet",);
        if (sheetUri === undefined) {
          return {
            ok: false,
            error: "status sheet selection cancelled",
            messages: [],
          };
        }
        return presentExecutionResult(
          uri,
          await service.checkStatusSheet(uri, sheetUri, options,),
          presentation,
        );
      },),
  );
  registerSheet("syntaxmesh.sheet.time.send", "ts-send",);
  registerSheet("syntaxmesh.sheet.time.receive", "ts-receive",);
  registerSheet("syntaxmesh.sheet.time.summary", "ts-summary",);
  registerSheet("syntaxmesh.sheet.status.send", "ss-send",);
  registerSheet("syntaxmesh.sheet.status.receive", "ss-receive",);
}
