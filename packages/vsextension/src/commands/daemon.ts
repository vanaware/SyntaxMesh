/**
 * Canonical project command group shared by Desktop and Web (22.12.19).
 *
 * The group only adapts VS Code prompts and messages to the shared project
 * service. Compatibility ids are registered separately as runtime aliases.
 */
import { window, workspace, } from "vscode";
import { getViews, withBusy, } from "../views/host.ts";
import type { CommandResult, } from "./contracts.ts";
import { guardedCommand, } from "./execution-actions.ts";
import type { CommandRegistry, } from "./registry.ts";
import type { CanonicalCommandDependencies, } from "./register.ts";
import { activeMasterUri, } from "./shared.ts";

/** Builds one structured cancellation or selection failure. */
function failure(message: string,): CommandResult<never> {
  return { ok: false, error: message, messages: [], };
}

/** Surfaces one service failure without changing the value returned to callers. */
function showFailure(result: { error: string },): void {
  window.showErrorMessage(`SyntaxMesh: ${result.error}`,);
}

/** Registers the five canonical project commands against the shared registry. */
export function registerProjectGroup(
  registry: CommandRegistry,
  dependencies: CanonicalCommandDependencies,
): void {
  const { diagnostics, service, } = dependencies;
  const trusted = <T,>(
    action: () => Promise<CommandResult<T>>,
  ): Promise<CommandResult<T>> =>
    guardedCommand(
      workspace.isTrusted,
      action,
      (message,) => window.showErrorMessage(message,),
    );
  const requireProject = (explicit?: string,): string | undefined => {
    const uri = explicit ?? activeMasterUri()?.toString();
    if (uri === undefined) {
      window.showWarningMessage("SyntaxMesh: open a project file first.",);
    }
    return uri;
  };

  registry.register(
    "syntaxmesh.project.add",
    (project?: string,) =>
      trusted(async () => {
        const uri = requireProject(project,);
        if (uri === undefined) return failure("open a project file first.",);
        const result = await withBusy(() => service.addProject(uri,));
        if (!result.ok) {
          showFailure(result,);
          return result;
        }
        diagnostics.clearProject(uri,);
        getViews()?.refresh();
        window.showInformationMessage(
          `SyntaxMesh: loaded ${result.value.entry} (${result.value.status}).`,
        );
        return result;
      },),
  );

  registry.register(
    "syntaxmesh.project.refresh",
    (project?: string,) =>
      trusted(async () => {
        const uri = requireProject(project,);
        if (uri === undefined) return failure("open a project file first.",);
        const result = await withBusy(() => service.refreshProject(uri,));
        if (!result.ok) {
          showFailure(result,);
          return result;
        }
        diagnostics.clearProject(uri,);
        getViews()?.refresh();
        window.showInformationMessage(
          `SyntaxMesh: reloaded ${result.value.entry} (${result.value.status}).`,
        );
        return result;
      },),
  );

  registry.register(
    "syntaxmesh.project.remove",
    (project?: string,) =>
      trusted(async () => {
        let uri = project;
        if (uri === undefined) {
          const listed = await service.listProjects();
          if (!listed.ok) {
            showFailure(listed,);
            return listed;
          }
          if (listed.value.length === 0) {
            window.showInformationMessage("SyntaxMesh: no projects loaded.",);
            return failure("no projects loaded",);
          }
          const pick = await window.showQuickPick(
            listed.value.map((summary,) => ({
              label: summary.entry,
              description: summary.status,
              uri: summary.uri,
            })),
            { placeHolder: "Select a project to remove", },
          );
          if (pick === undefined) {
            return failure("project selection cancelled",);
          }
          uri = pick.uri;
        }

        const result = await withBusy(() => service.removeProject(uri,));
        if (!result.ok) {
          showFailure(result,);
          return result;
        }
        diagnostics.clearProject(uri,);
        getViews()?.refresh();
        window.showInformationMessage(`SyntaxMesh: removed ${uri}.`,);
        return result;
      },),
  );

  registry.register("syntaxmesh.project.list", () =>
    trusted(async () => {
      const result = await service.listProjects();
      if (!result.ok) {
        showFailure(result,);
        return result;
      }
      if (result.value.length === 0) {
        window.showInformationMessage("SyntaxMesh: no projects loaded.",);
        return result;
      }
      await window.showQuickPick(
        result.value.map((summary,) => ({
          label: summary.entry,
          description: `${summary.status} · ${summary.reportCount} reports`,
        })),
        { placeHolder: "Loaded projects", },
      );
      return result;
    },),);

  registry.register(
    "syntaxmesh.project.setActive",
    (project?: string,) =>
      trusted(async () => {
        let uri = project;
        if (uri === undefined) {
          const listed = await service.listProjects();
          if (!listed.ok) {
            showFailure(listed,);
            return listed;
          }
          if (listed.value.length === 0) {
            window.showInformationMessage("SyntaxMesh: no projects loaded.",);
            return failure("no projects loaded",);
          }
          const active = activeMasterUri()?.toString();
          const current = listed.value.find((summary,) =>
            summary.uri === active
          );
          uri = current?.uri ??
            (listed.value.length === 1 ? listed.value[0]?.uri : undefined);
          if (uri === undefined) {
            const pick = await window.showQuickPick(
              listed.value.map((summary,) => ({
                label: summary.entry,
                description: summary.status,
                uri: summary.uri,
              })),
              { placeHolder: "Select the active project", },
            );
            uri = pick?.uri;
          }
          if (uri === undefined) return failure("project selection cancelled",);
        }

        const result = await withBusy(() => service.setActiveProject(uri,));
        if (!result.ok) {
          showFailure(result,);
          return result;
        }
        getViews()?.refresh();
        window.showInformationMessage(
          `SyntaxMesh: active project set to ${result.value.entry}.`,
        );
        return result;
      },),
  );
}
