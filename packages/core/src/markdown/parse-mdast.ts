/**
 * parseMdast — `micromark` integration (phase 13.1).
 *
 * `micromark`/`@deno/gfm` render HTML; what SyntaxMesh needs is the **AST**
 * (`mdast`), obtained with `mdast-util-from-markdown` plus the GFM extensions
 * (tables, `~~strikethrough~~`, autolinks, task lists). That is the ADR 026
 * decision: a parser that returns a tree, not markup.
 *
 * @see ADR 026 (Markdown as the going-forward format)
 * @see https://github.com/syntax-tree/mdast
 */

import { fromMarkdown, } from "mdast-util-from-markdown";
import { gfm, } from "micromark-extension-gfm";
import { gfmFromMarkdown, } from "mdast-util-gfm";
import type { MdastInline, MdastRoot, } from "./types.ts";
// The augmentation of the `mdast` types (`richtextExtension` node) lives here.
import "./types.ts";

/**
 * Parses Markdown (CommonMark + GFM) into the `mdast` AST.
 *
 * @param text Markdown source (already pre-processed by the extensions, if any).
 * @returns Root node of the resulting `mdast` tree.
 */
export function parseMdast(text: string,): MdastRoot {
  return fromMarkdown(text, {
    extensions: [gfm(),],
    mdastExtensions: [gfmFromMarkdown(),],
  },);
}

/**
 * Parses an **inline** snippet and returns the children of the resulting
 * paragraph. Used by the extensions to reprocess the content of
 * `<fcol:…>…</fcol>`.
 *
 * @param text Markdown source to parse as inline content.
 * @returns The inline nodes found, or the raw text when the snippet is not a
 *   single paragraph.
 */
export function parseMdastInline(text: string,): MdastInline[] {
  if (text === "") return [];
  const root = parseMdast(text,);
  const first = root.children[0];
  if (first && first.type === "paragraph" && root.children.length === 1) {
    // `Paragraph.children` is `PhrasingContent[]`; the `RootContent` union does
    // not expose the field, so we narrow it via the `type` just checked.
    return (first as unknown as { children: MdastInline[] }).children;
  }
  // Content that is not a single paragraph (e.g. starting with `#`): the raw
  // text is preserved instead of dropping the markup.
  return [{ type: "text", value: text, },];
}
