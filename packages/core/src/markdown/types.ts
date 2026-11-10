/**
 * Shared types of the Markdown subsystem (phase 13).
 *
 * The base parser is `micromark` + `mdast-util-from-markdown` (plus GFM), which
 * produces an `mdast` AST. Markdown does not cover `<fcol:…>`, `[[func:…]]` and
 * `<-…->`, so the extensions **pre/post-process** the text and inject a
 * synthetic node into the AST (`richtextExtension`) — that is why the content
 * maps of the `mdast` module are augmented here instead of declaring a parallel
 * type.
 *
 * @see ADR 026 (Markdown as the going-forward format)
 * @see docs/syntaxmesh/fases/fase-13-markdown.md §4.2
 */

import type { PhrasingContent, Root, } from "mdast";

declare module "mdast" {
  /**
   * Synthetic node created by the Markdown extensions (13.4–13.8). It does not
   * exist in the `mdast` vocabulary; it carries the category of the equivalent
   * `RichTextElement` and its `payload`.
   */
  interface RichTextExtensionNode {
    type: "richtextExtension";
    /** Category of the RichText element that will be built (13.2). */
    category: "fontCol" | "inlinefunc" | "blockfunc";
    /**
     * `data` of the RichText element: a string (colour) for `fontCol`, or
     * `[name, args]` for `inlinefunc`/`blockfunc`.
     */
    payload: string | [string, Record<string, string>,];
    /** Inner content (only `fontCol` has children). */
    children: PhrasingContent[];
  }

  interface ContentMap {
    richtextExtension: RichTextExtensionNode;
  }

  interface PhrasingContentMap {
    richtextExtension: RichTextExtensionNode;
  }
}

/** Root of the `mdast` AST produced by {@link parseMdast}. */
export type MdastRoot = Root;

/** Block-level nodes (children of the root: paragraph, list, table, …). */
export type MdastBlock = MdastRoot["children"][number];

/** Any `mdast` node we walk (root, blocks and inline). */
export type MdastNode = MdastRoot | MdastBlock | MdastInline;

/** Inline nodes (children of a paragraph, heading, link, …). */
export type MdastInline = PhrasingContent;

/** Synthetic node of the extensions (re-exported for convenience). */
export type MdastExtension = import("mdast").RichTextExtensionNode;

/** RichText categories that the markdown extensions produce. */
export type ExtensionCategory = "fontCol" | "inlinefunc" | "blockfunc";

/** Generic extraction registered by the pipeline (13.8.2). */
export interface Extraction {
  /** Unique placeholder left in the text (`§COLOR_0§`). */
  placeholder: string;
  /** Category of the resulting RichText element. */
  category: ExtensionCategory;
  /** `data` of the element (`color` or `[name, args]`). */
  payload: string | [string, Record<string, string>,];
  /** Original text captured (includes the markup of the extension). */
  source: string;
  /** Inner content to reprocess (only `<fcol:…>…</fcol>`). */
  content?: string;
}

/** Result of an extension `preprocess*` (13.4.3, 13.6.3, 13.7.2). */
export interface PreprocessResult<T,> {
  /** Text with placeholders in place of the extensions. */
  text: string;
  /** Extractions registered in this pass. */
  extractions: T[];
}

/**
 * Functions that, alone in a paragraph, become `blockfunc` (13.6.8).
 * Mirrors `blockFunction = true` of the phase 12 handlers (`RTFReport`,
 * `RTFNavigator`).
 */
export const DEFAULT_BLOCK_FUNCTIONS = ["report", "navigator",];

/** Name of the `[[name:…]]`/`<-[name …]->` functions recognised by phase 12. */
export const DEFAULT_KNOWN_FUNCTIONS = [
  "query",
  "report",
  "reportlink",
  "navigator",
];
