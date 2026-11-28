/**
 * Pure project-reference resolution (22.12.3). Selection priority is explicit
 * argument, active registry entry, valid active master editor, then one loaded
 * project. Invalid explicit references never silently fall through to another
 * project.
 */
import type { CommandResult, ProjectDocumentRef, } from "./contracts.ts";

/** Inputs are plain data so the same resolver serves every command adapter. */
export interface ProjectRefInput {
  explicit?: string;
  activeRegistry?: string;
  activeDocument?: ProjectDocumentRef;
  projects: string[];
}

/** Builds a structured resolver failure. */
function failure(error: string,): CommandResult<string> {
  return { ok: false, error, messages: [], };
}

/** Validates one native or compatibility master URI. */
function master(uri: string,): CommandResult<string> {
  if (!/\.(smx|tjp)$/.test(uri,)) {
    return failure(`invalid project master URI: ${uri}`,);
  }
  return { ok: true, value: uri, messages: [], };
}

/** Resolves an unambiguous project master from the supplied references. */
export function resolveProjectUri(
  input: ProjectRefInput,
): CommandResult<string> {
  if (input.explicit !== undefined) return master(input.explicit,);
  if (input.activeRegistry !== undefined) return master(input.activeRegistry,);

  if (input.activeDocument?.languageId === "syntaxmesh") {
    const resolved = master(input.activeDocument.uri,);
    if (resolved.ok) return resolved;
  }

  const projects = [...new Set(input.projects,),];
  if (projects.length > 1) {
    return failure("multiple projects loaded; select a project explicitly",);
  }
  const only = projects[0];
  if (only === undefined) return failure("no project master selected",);
  return master(only,);
}
