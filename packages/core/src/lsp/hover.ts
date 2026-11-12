/**
 * `hover.ts` — hover information for one document position (22.1.10).
 *
 * Two sources, both projections (no reimplementation):
 *
 * - **keyword** under the cursor → the embedded reference of the doc-core
 *   via {@link getKeywordHelp} (junction with I 7.5);
 * - **identifier** under the cursor → the declaring node of the parsed model
 *   (via {@link findSymbolNode}): entity kind, id, human name, declaration
 *   location and the attributes **written in the node's source block**. The
 *   model's `provided` flag cannot be used: the engine also marks derived
 *   values (duration, projectid, …) as provided, so the source text is the
 *   only faithful record of what the user wrote.
 *
 * Literals, comments and whitespace carry nothing useful: `null`.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (getHover)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { AnalysisResult, } from "./analyze.ts";
import { getKeywordHelp, } from "./help.ts";
import { findSymbolNode, } from "./navigation.ts";
import { type PositionedToken, tokenAt, tokenize, } from "./semantic-tokens.ts";
import type { Hover, Position, Range, } from "./types.ts";

/** Keywords that open a new declaration (boundary of a block-less node). */
const DECLARATION_KEYWORDS: ReadonlySet<string> = new Set([
  "project",
  "task",
  "resource",
  "account",
  "shift",
  "report",
  "material",
  "scenario",
  "supplement",
],);

/** Offset of the first character of every line (index = line number). */
function lineStartsOf(text: string,): number[] {
  const starts: number[] = [0,];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1,);
  }
  return starts;
}

/**
 * Attribute keywords written directly in a node's block (depth 1). Strings
 * and comments are masked before brace matching so their braces do not
 * count; nested blocks (subtasks, option blocks) are excluded by depth.
 * Returns `[]` for block-less declarations or missing source info.
 */
function writtenAttributes(
  analysis: AnalysisResult,
  node: PropertyTreeNode,
): string[] {
  const sfi = node.sourceFileInfo;
  if (sfi === null) return [];
  const text = analysis.text;
  const starts = lineStartsOf(text,);
  const declLine = Math.max(0, sfi.lineNo - 1,);
  const tokens = tokenize(text,);
  // Mask strings/comments (keep newlines so line offsets stay valid).
  const chars = text.split("",);
  const keywordAt = new Map<number, PositionedToken>();
  for (const token of tokens) {
    const offset = starts[token.line]! + token.character;
    if (token.type === "string" || token.type === "comment") {
      for (let k = offset; k < offset + token.length; k++) {
        if (chars[k] !== "\n") chars[k] = " ";
      }
    } else if (token.type === "keyword") {
      keywordAt.set(offset, token,);
    }
  }
  const masked = chars.join("",);
  const names = new Set<string>();
  let depth = 0;
  let blockStart = -1;
  for (let offset = starts[declLine]!; offset < masked.length; offset++) {
    const char = masked[offset];
    if (char === "{") {
      depth++;
      if (blockStart === -1) blockStart = offset;
      continue;
    }
    if (char === "}") {
      depth--;
      if (blockStart !== -1 && depth === 0) break;
      continue;
    }
    if (blockStart !== -1 && depth === 1) {
      const token = keywordAt.get(offset,);
      // A keyword glued to a number is a duration unit (`5d`), not an
      // attribute.
      const previous = offset > 0 ? masked[offset - 1] : "";
      if (token !== undefined && !/[0-9]/.test(previous ?? "",)) {
        names.add(text.slice(offset, offset + token.length,),);
      }
    } else if (blockStart === -1 && depth === 0) {
      // A new declaration before any opening brace: block-less node.
      const token = keywordAt.get(offset,);
      if (
        token !== undefined && token.line > declLine &&
        DECLARATION_KEYWORDS.has(text.slice(offset, offset + token.length,),)
      ) return [];
    }
  }
  return [...names,].sort();
}

/** Markdown of one model node: kind, id, name, location, written attributes. */
function nodeMarkdown(
  kind: string,
  node: PropertyTreeNode,
  analysis: AnalysisResult,
): string {
  const lines = [`**${kind}** \`${node.id}\` — ${node.name}`,];
  const sfi = node.sourceFileInfo;
  if (sfi !== null) {
    lines.push("", `Declared at ${sfi.fileName}:${sfi.lineNo}`,);
  }
  const attributes = writtenAttributes(analysis, node,);
  if (attributes.length > 0) {
    lines.push("", `Attributes: ${attributes.join(", ",)}`,);
  }
  return lines.join("\n",);
}

/**
 * Hover of the token under the cursor: the doc-core reference for keywords,
 * the model summary for declared identifiers, `null` for everything else
 * (literals, comments, whitespace, unknown names, unparsed documents).
 *
 * @param analysis result of {@link analyzeDocument}.
 * @param position 0-based cursor position.
 * @returns the hover with its Markdown content and token range, or `null`.
 */
export function getHover(
  analysis: AnalysisResult,
  position: Position,
): Hover | null {
  const token = tokenAt(analysis.text, position,);
  if (token === null) return null;
  const range: Range = {
    start: { line: token.line, character: token.character, },
    end: { line: token.line, character: token.character + token.length, },
  };
  const lineText = analysis.text.split("\n",)[token.line] ?? "";
  const text = lineText.slice(token.character, token.character + token.length,);
  if (token.type === "keyword") {
    const help = getKeywordHelp(text,);
    if (help === null) return null;
    return { contents: { kind: "markdown", value: help, }, range, };
  }
  if (token.type === "identifier" && analysis.project !== null) {
    const found = findSymbolNode(analysis.project, text,);
    if (found === null) return null;
    return {
      contents: {
        kind: "markdown",
        value: nodeMarkdown(found.kind, found.node, analysis,),
      },
      range,
    };
  }
  return null;
}
