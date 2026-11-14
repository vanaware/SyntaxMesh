/**
 * `grammar/snippets.ts` — pure VS Code snippets (22.3.4).
 *
 * English-only (v1) skeletons of the most common SyntaxMesh declarations,
 * grounded in the tutorial corpus (`docs/Learning/mwe00*`). Each snippet uses
 * VS Code tab stops (`${1:placeholder}`) and a final `$0` cursor position. The
 * generate script (22.3.5) serializes {@link SNIPPETS} to `snippets/syntaxmesh.json`.
 *
 * `material` is included forward-looking: its cost model landed in Fase 8.1,
 * while the parser keyword is still pending (Fase 10 Complemento).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §6
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.3.4
 */

import type { Snippet, } from "./types.ts";

/** The six v1 snippets, keyed by their trigger prefix. */
export const SNIPPETS: Record<string, Snippet> = {
  project: {
    prefix: "project",
    body: [
      'project ${1:prj} "${2:Project Name}" "${3:1.0}" ${4:2026-01-01} - ${5:2026-12-31} {',
      '  timeformat "%Y-%m-%d"',
      "  $0",
      "}",
    ],
    description: "Project header with id, name, version and timeframe",
  },
  task: {
    prefix: "task",
    body: [
      'task ${1:tsk} "${2:Task Name}" {',
      "  effort ${3:1d}",
      "  allocate ${4:dev}",
      "  $0",
      "}",
    ],
    description: "Task with an effort estimate and allocation",
  },
  resource: {
    prefix: "resource",
    body: [
      'resource ${1:dev} "${2:Resource Name}" {',
      "  $0",
      "}",
    ],
    description: "Resource declaration",
  },
  account: {
    prefix: "account",
    body: [
      'account ${1:acc} "${2:Account Name}" {',
      "  $0",
      "}",
    ],
    description: "Account declaration for cost tracking",
  },
  report: {
    prefix: "report",
    body: [
      '${1|taskreport,resourcereport,textreport|} "${2:Report Name}" {',
      "  formats ${3:html}",
      '  headline "${4:Report Headline}"',
      "  $0",
      "}",
    ],
    description: "Report (task/resource/text) with an HTML format",
  },
  material: {
    prefix: "material",
    body: [
      'material ${1:mat} "${2:Material Name}" {',
      "  $0",
      "}",
    ],
    description: "Material declaration (Fase 8.1 cost model)",
  },
};
