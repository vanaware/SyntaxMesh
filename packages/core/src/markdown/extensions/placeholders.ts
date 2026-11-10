/**
 * Markdown extension placeholders (phase 13.4–13.8).
 *
 * The extensions (`<fcol:…>`, `[[func:…]]`, `<-name->`) are pulled out of the
 * text before the `mdast` parse and come back as synthetic
 * `richtextExtension` nodes afterwards. This module centralizes the machinery
 * (text splitting, node building, recursive content expansion) so that each
 * extension only has to describe its regex and its payload.
 *
 * @see ADR 026 (Markdown as the going-forward format)
 * @see docs/syntaxmesh/fases/fase-13-markdown.md §4.2
 */

import type { PhrasingContent, } from "mdast";
import { parseMdastInline, } from "../parse-mdast.ts";
import type { Extraction, MdastExtension, MdastNode, } from "../types.ts";

/** Placeholder delimiter (`§COLOR_0§`). Deliberately rare in Markdown. */
export const PLACEHOLDER_DELIM = "§";

/** Builds the placeholder of an extension kind (`COLOR`, `FUNC`, `MINIQ`). */
export function placeholderFor(kind: string, index: number,): string {
  return `${PLACEHOLDER_DELIM}${kind}_${index}${PLACEHOLDER_DELIM}`;
}

/** An `Extraction` addressable by placeholder. */
export interface ExtensionResolver {
  /** Looks up the extraction of the placeholder (`undefined` if not one). */
  lookup(placeholder: string,): Extraction | undefined;
  /**
   * Functions recognized by the phase 12 handlers. When absent, all of them
   * are accepted; when present, an unknown function falls back to raw text.
   */
  isKnownFunction?(name: string,): boolean;
  /** Functions that become `blockfunc` when alone in a paragraph. */
  isBlockFunction?(name: string,): boolean;
}

/** Resolver backed by a collection of extractions (tests and pipeline). */
export function mapResolver(
  extractions: Iterable<Extraction>,
  options: {
    isKnownFunction?: (name: string,) => boolean;
    isBlockFunction?: (name: string,) => boolean;
  } = {},
): ExtensionResolver {
  const map = new Map<string, Extraction>();
  for (const e of extractions) map.set(e.placeholder, e,);
  return {
    lookup: (p: string,) => map.get(p,),
    isKnownFunction: options.isKnownFunction,
    isBlockFunction: options.isBlockFunction,
  };
}

/** Slice of the text resulting from splitting by placeholders. */
export type TextSlice =
  | { kind: "text"; value: string }
  | { kind: "extension"; extraction: Extraction };

/** Splits `value` at the occurrences of the placeholders in the resolver. */
export function splitPlaceholders(
  value: string,
  resolver: ExtensionResolver,
): TextSlice[] {
  const slices: TextSlice[] = [];
  let rest = value;
  while (true) {
    let best: { index: number; length: number; extraction: Extraction } | null =
      null;
    // Look for the leftmost placeholder among all registered ones.
    for (const candidate of knownPlaceholders(rest, resolver,)) {
      const e = resolver.lookup(candidate,);
      if (!e) continue;
      const index = rest.indexOf(candidate,);
      if (index < 0) continue;
      if (!best || index < best.index) {
        best = { index, length: candidate.length, extraction: e, };
      }
    }
    if (!best) {
      if (rest !== "") slices.push({ kind: "text", value: rest, },);
      return slices;
    }
    if (best.index > 0) {
      slices.push({ kind: "text", value: rest.slice(0, best.index,), },);
    }
    slices.push({ kind: "extension", extraction: best.extraction, },);
    rest = rest.slice(best.index + best.length,);
  }
}

/** Placeholders (prefix `§`) that appear in `text`. */
function knownPlaceholders(
  text: string,
  resolver: ExtensionResolver,
): string[] {
  const found = text.match(/§[A-Z]+_\d+§/g,);
  if (!found) return [];
  return found.filter((p,) => resolver.lookup(p,) !== undefined);
}

/** `[name, args]` payload of a function. */
function funcPayload(e: Extraction,): [string, Record<string, string>,] | null {
  return Array.isArray(e.payload,)
    ? e.payload as [string, Record<string, string>,]
    : null;
}

/** Builds the synthetic node of an extraction (recursive content in `fontCol`). */
export function buildExtensionNode(
  e: Extraction,
  resolver: ExtensionResolver,
): MdastExtension | PhrasingContent {
  const func = funcPayload(e,);
  if (func && resolver.isKnownFunction && !resolver.isKnownFunction(func[0],)) {
    // Unknown function → raw text, no markup and no exception in `to_s`.
    return { type: "text", value: e.source, };
  }
  const children: PhrasingContent[] = e.content !== undefined
    ? expandInline(e.content, resolver,)
    : [];
  return {
    type: "richtextExtension",
    category: e.category,
    payload: e.payload,
    children,
  };
}

/** Parses inline extension content and expands nested placeholders. */
export function expandInline(
  content: string,
  resolver: ExtensionResolver,
): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  for (const node of parseMdastInline(content,)) {
    out.push(...expandNodeInline(node, resolver,),);
  }
  return out;
}

/** Expands placeholders inside an inline node (text → 0..n nodes). */
function expandNodeInline(
  node: PhrasingContent,
  resolver: ExtensionResolver,
): PhrasingContent[] {
  if (node.type !== "text") return [node,];
  const value = (node as { value: string }).value;
  const slices = splitPlaceholders(value, resolver,);
  if (slices.length === 1 && slices[0]!.kind === "text") return [node,];
  return slicesToPhrasing(slices, resolver,);
}

/** Converts the slices into inline `mdast` nodes. */
function slicesToPhrasing(
  slices: TextSlice[],
  resolver: ExtensionResolver,
): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  for (const slice of slices) {
    if (slice.kind === "text") {
      out.push({ type: "text", value: slice.value, },);
    } else {
      out.push(
        buildExtensionNode(slice.extraction, resolver,) as PhrasingContent,
      );
    }
  }
  return out;
}

/** Nodes with inline `children` that must be traversed. */
interface HasChildren {
  children: PhrasingContent[];
}

function hasInlineChildren(node: unknown,): node is HasChildren {
  return typeof node === "object" && node !== null &&
    Array.isArray((node as HasChildren).children,);
}

/**
 * Walks `node` (mutating the child arrays) expanding placeholders and
 * promoting lone block functions to `blockfunc` (13.6.8).
 *
 * Returns the node itself, as the extension `postprocess*` hooks expect
 * (13.4.5, 13.6.8, 13.7.4).
 */
export function walkAndExpand(
  node: MdastNode,
  extractions: Iterable<Extraction>,
  options: {
    isKnownFunction?: (name: string,) => boolean;
    isBlockFunction?: (name: string,) => boolean;
  } = {},
): MdastNode {
  expandChildren(
    node as unknown as HasChildren,
    mapResolver(extractions, options,),
  );
  return node;
}

function expandChildren(
  parent: HasChildren,
  resolver: ExtensionResolver,
): void {
  const out: PhrasingContent[] = [];
  for (const child of parent.children) {
    if (hasInlineChildren(child,) && child.type !== "richtextExtension") {
      expandChildren(child, resolver,);
    }
    if (child.type === "text") {
      out.push(...expandNodeInline(child, resolver,),);
    } else {
      out.push(child,);
    }
  }
  parent.children = out;
  promoteLoneBlockFunction(parent, resolver,);
}

/** A paragraph holding a single block function becomes `blockfunc`. */
function promoteLoneBlockFunction(
  parent: HasChildren,
  resolver: ExtensionResolver,
): void {
  if (parent.children.length !== 1) return;
  const only = parent.children[0] as unknown as Partial<MdastExtension>;
  if (only.type !== "richtextExtension" || only.category !== "inlinefunc") {
    return;
  }
  const name = Array.isArray(only.payload,) ? only.payload[0] : "";
  if (resolver.isBlockFunction?.(name,)) {
    (only as MdastExtension).category = "blockfunc";
  }
}
