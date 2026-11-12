/**
 * `navigation.ts` — go-to-definition and find-references (22.1.12).
 *
 * Definitions come from the parsed model: every node carries the
 * `sourceFileInfo` of its declaration, so the jump target is the node's id
 * looked up across the project's property sets. References are an **id scan**
 * over the token stream (the task's "varredura de ids"): every identifier
 * token equal to the symbol is a usage, which yields exact spans and works
 * across files when several analyses are aggregated — no scheduling needed.
 *
 * Positions are 0-based (protocol). The engine's `sourceFileInfo` is 1-based
 * and line-level, so declaration ranges are refined against the text when the
 * identifier can be located on the reported line.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (getDefinition/getReferences)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import type { Project, } from "../model/project.ts";
import type { PropertySet, } from "../model/property-set.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { AnalysisResult, } from "./analyze.ts";
import { tokenAt, tokenize, } from "./semantic-tokens.ts";
import type { Location, Position, } from "./types.ts";

/** Offset of the first character of every line (index = line number). */
function lineStartsOf(text: string,): number[] {
  const starts: number[] = [0,];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1,);
  }
  return starts;
}

/** Last dotted segment of an id (`prj.a` → `a`). */
function lastSegment(id: string,): string {
  const dot = id.lastIndexOf(".",);
  return dot === -1 ? id : id.slice(dot + 1,);
}

/**
 * The identifier under a position, or `null` when the cursor is not on a
 * user-defined name (keywords, literals and whitespace are not symbols).
 *
 * @param text full document text.
 * @param position 0-based cursor position.
 * @returns the identifier text (possibly dotted), or `null`.
 */
export function symbolAt(text: string, position: Position,): string | null {
  const token = tokenAt(text, position,);
  if (token === null || token.type !== "identifier") return null;
  const starts = lineStartsOf(text,);
  const offset = starts[token.line]! + token.character;
  return text.slice(offset, offset + token.length,);
}

/** A resolved symbol: its declaring node plus the entity kind label. */
export interface SymbolNode {
  /** The declaring node of the model. */
  node: PropertyTreeNode;
  /** Entity kind (`task`, `resource`, `account`, `shift`, `report`, …). */
  kind: string;
}

/** Every node of the project, across all of its property sets, with kind. */
function collectNodes(project: Project,): SymbolNode[] {
  const sets: Array<[PropertySet, string,]> = [
    [project.tasks, "task",],
    [project.resources, "resource",],
    [project.accounts, "account",],
    [project.shifts, "shift",],
    [project.reports, "report",],
    [project.materials, "material",],
    [project.scenarios, "scenario",],
  ];
  const nodes: SymbolNode[] = [];
  for (const [set, kind,] of sets) {
    for (const node of set.toArray()) nodes.push({ node, kind, },);
  }
  return nodes;
}

/**
 * Resolves a symbol to its declaring node. Full-id matches win over relative
 * (sub-id) matches, which win over last-segment matches.
 *
 * @param project the parsed project to search.
 * @param symbol identifier text (possibly dotted).
 * @returns the declaring node with its kind, or `null` when unknown.
 */
export function findSymbolNode(
  project: Project,
  symbol: string,
): SymbolNode | null {
  const nodes = collectNodes(project,);
  return nodes.find((e,) => e.node.id === symbol) ??
    nodes.find((e,) => e.node.subId === symbol) ??
    nodes.find((e,) => lastSegment(e.node.id,) === lastSegment(symbol,)) ??
    null;
}

/**
 * Location of a node's declaration. The engine reports a 1-based line; the
 * range is refined to the identifier's span on that line when found, else it
 * falls back to the start of the line.
 */
function declarationLocation(
  analysis: AnalysisResult,
  node: PropertyTreeNode,
  symbol: string,
): Location | null {
  const sfi = node.sourceFileInfo;
  if (sfi === null) return null;
  const line = Math.max(0, sfi.lineNo - 1,);
  const starts = lineStartsOf(analysis.text,);
  for (const token of tokenize(analysis.text,)) {
    if (token.type !== "identifier" || token.line !== line) continue;
    const offset = starts[line]! + token.character;
    const text = analysis.text.slice(offset, offset + token.length,);
    if (text === symbol || lastSegment(text,) === lastSegment(symbol,)) {
      return {
        uri: sfi.fileName,
        range: {
          start: { line, character: token.character, },
          end: { line, character: token.character + token.length, },
        },
      };
    }
  }
  return {
    uri: sfi.fileName,
    range: {
      start: { line, character: 0, },
      end: { line, character: 0, },
    },
  };
}

/**
 * Jumps from the symbol under the cursor to its declaration.
 *
 * Searches the current analysis first, then the rest of the workspace (when
 * provided) so a reference in one file can reach a declaration in another.
 *
 * @param analysis the document the cursor is in.
 * @param position 0-based cursor position.
 * @param workspace optional aggregated analyses (cross-file); defaults to the
 *        current one.
 * @returns the declaration location, or `null` when the symbol is unknown.
 */
export function getDefinition(
  analysis: AnalysisResult,
  position: Position,
  workspace?: readonly AnalysisResult[],
): Location | null {
  const symbol = symbolAt(analysis.text, position,);
  if (symbol === null) return null;
  const analyses = workspace ?? [analysis,];
  for (const candidate of analyses) {
    if (candidate.project === null) continue;
    const found = findSymbolNode(candidate.project, symbol,);
    if (found !== null) {
      const location = declarationLocation(candidate, found.node, symbol,);
      if (location !== null) return location;
    }
  }
  return null;
}

/**
 * Finds every usage of the symbol under the cursor by scanning identifier
 * tokens. Matches the exact id and its dotted variants (`a` ↔ `prj.a`). The
 * declaration itself is included. Scans the whole workspace when provided.
 *
 * @param analysis the document the cursor is in.
 * @param position 0-based cursor position.
 * @param workspace optional aggregated analyses (cross-file); defaults to the
 *        current one.
 * @returns one location per usage, in document then source order.
 */
export function getReferences(
  analysis: AnalysisResult,
  position: Position,
  workspace?: readonly AnalysisResult[],
): Location[] {
  const symbol = symbolAt(analysis.text, position,);
  if (symbol === null) return [];
  const target = lastSegment(symbol,);
  const analyses = workspace ?? [analysis,];
  const locations: Location[] = [];
  for (const candidate of analyses) {
    const starts = lineStartsOf(candidate.text,);
    for (const token of tokenize(candidate.text,)) {
      if (token.type !== "identifier") continue;
      const offset = starts[token.line]! + token.character;
      const text = candidate.text.slice(offset, offset + token.length,);
      if (text !== symbol && lastSegment(text,) !== target) continue;
      locations.push({
        uri: candidate.uri,
        range: {
          start: { line: token.line, character: token.character, },
          end: { line: token.line, character: token.character + token.length, },
        },
      },);
    }
  }
  return locations;
}
