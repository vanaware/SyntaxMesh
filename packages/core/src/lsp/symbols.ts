/**
 * `symbols.ts` — document outline and workspace symbol search (22.1.14).
 *
 * `getDocumentSymbols` builds the hierarchy project → task → subtask (plus
 * resources/accounts/shifts/reports/materials as siblings) from the parsed
 * model; `getWorkspaceSymbols` flattens every node of the aggregated analyses
 * and filters by a case-insensitive query over id and name.
 *
 * Ranges: the engine's `sourceFileInfo` is line-level, so a symbol's `range`
 * spans from its declaration line to the deepest declaration line of its
 * subtree (keeping children enclosed), and `selectionRange` is refined to the
 * identifier's exact span on the declaration line.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (symbols)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import type { Project, } from "../model/project.ts";
import type { PropertySet, } from "../model/property-set.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { AnalysisResult, } from "./analyze.ts";
import { type PositionedToken, tokenize, } from "./semantic-tokens.ts";
import type { DocumentSymbol, Range, SymbolInformation, } from "./types.ts";

/** `SymbolKind.Module` — the project root. */
const KIND_PROJECT = 2;

/**
 * The entity sets exposed as symbols, with their protocol `SymbolKind`:
 * task=Class(5), resource=Variable(13), account=Enum(10), shift=Constant(14),
 * report=Function(12), material=Object(19).
 */
function setsOf(project: Project,): Array<{ set: PropertySet; kind: number }> {
  return [
    { set: project.tasks, kind: 5, },
    { set: project.resources, kind: 13, },
    { set: project.accounts, kind: 10, },
    { set: project.shifts, kind: 14, },
    { set: project.reports, kind: 12, },
    { set: project.materials, kind: 19, },
  ];
}

/** Last dotted segment of an id (`outer.inner` → `inner`). */
function lastSegment(id: string,): string {
  const dot = id.lastIndexOf(".",);
  return dot === -1 ? id : id.slice(dot + 1,);
}

/** 0-based declaration line of a node (line-level `sourceFileInfo`). */
function declLine(node: PropertyTreeNode,): number {
  const sfi = node.sourceFileInfo;
  return sfi === null ? 0 : Math.max(0, sfi.lineNo - 1,);
}

/** Deepest declaration line across a node's whole subtree. */
function subtreeLastLine(node: PropertyTreeNode,): number {
  let last = declLine(node,);
  for (const child of node.children) {
    last = Math.max(last, subtreeLastLine(child,),);
  }
  return last;
}

/**
 * Exact span of a node's identifier on its declaration line, located among the
 * identifier tokens; falls back to the start of the line when not found.
 */
function spanOf(
  tokens: readonly PositionedToken[],
  lines: readonly string[],
  line: number,
  id: string,
): Range {
  const lineText = lines[line] ?? "";
  for (const token of tokens) {
    if (token.type !== "identifier" || token.line !== line) continue;
    const text = lineText.slice(
      token.character,
      token.character + token.length,
    );
    if (text === id || lastSegment(text,) === lastSegment(id,)) {
      return {
        start: { line, character: token.character, },
        end: { line, character: token.character + token.length, },
      };
    }
  }
  return {
    start: { line, character: 0, },
    end: { line, character: 0, },
  };
}

/** Builds one node's symbol, recursing into its real-hierarchy children. */
function buildSymbol(
  node: PropertyTreeNode,
  kind: number,
  tokens: readonly PositionedToken[],
  lines: readonly string[],
): DocumentSymbol {
  const line = declLine(node,);
  const last = subtreeLastLine(node,);
  const children = node.children.map((child,) =>
    buildSymbol(child, kind, tokens, lines,)
  );
  return {
    name: node.id,
    detail: node.name,
    kind,
    range: {
      start: { line, character: 0, },
      end: { line: last, character: (lines[last] ?? "").length, },
    },
    selectionRange: spanOf(tokens, lines, line, node.id,),
    children: children.length > 0 ? children : undefined,
  };
}

/**
 * The document outline: a single project root whose children are the top-level
 * tasks (with their subtasks), resources, accounts, shifts, reports and
 * materials. Returns `[]` when the analysis has no parsed project.
 *
 * @param analysis result of {@link analyzeDocument}.
 * @returns the hierarchical symbols of the document.
 */
export function getDocumentSymbols(
  analysis: AnalysisResult,
): DocumentSymbol[] {
  const project = analysis.project;
  if (project === null) return [];
  const tokens = tokenize(analysis.text,);
  const lines = analysis.text.split("\n",);
  const lastLine = lines.length - 1;
  const children: DocumentSymbol[] = [];
  for (const { set, kind, } of setsOf(project,)) {
    for (const node of set.toArray()) {
      if (node.parent !== null) continue;
      children.push(buildSymbol(node, kind, tokens, lines,),);
    }
  }
  const root: DocumentSymbol = {
    name: project.id,
    kind: KIND_PROJECT,
    range: {
      start: { line: 0, character: 0, },
      end: { line: lastLine, character: (lines[lastLine] ?? "").length, },
    },
    selectionRange: spanOf(tokens, lines, 0, project.id,),
    children,
  };
  return [root,];
}

/**
 * Flat symbol search across the aggregated analyses. The query is a
 * case-insensitive substring matched against both the id and the human name;
 * an empty query returns every symbol.
 *
 * @param analyses the workspace analyses to search.
 * @param query case-insensitive search text (empty = all).
 * @returns one entry per matching node, in analysis then declaration order.
 */
export function getWorkspaceSymbols(
  analyses: readonly AnalysisResult[],
  query: string,
): SymbolInformation[] {
  const needle = query.toLowerCase();
  const symbols: SymbolInformation[] = [];
  for (const analysis of analyses) {
    const project = analysis.project;
    if (project === null) continue;
    const tokens = tokenize(analysis.text,);
    const lines = analysis.text.split("\n",);
    for (const { set, kind, } of setsOf(project,)) {
      for (const node of set.toArray()) {
        if (
          needle !== "" &&
          !node.id.toLowerCase().includes(needle,) &&
          !node.name.toLowerCase().includes(needle,)
        ) continue;
        const line = declLine(node,);
        symbols.push({
          name: node.id,
          kind,
          location: {
            uri: analysis.uri,
            range: spanOf(tokens, lines, line, node.id,),
          },
          containerName: node.parent?.id,
        },);
      }
    }
  }
  return symbols;
}
