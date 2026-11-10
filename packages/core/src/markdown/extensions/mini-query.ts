/**
 * Extension for `<-name->` mini-queries (phase 13.7).
 *
 * Sugary equivalent of `[[query:attribute=name]]` (13.6), and the same syntax
 * as RichText (`INLINEFUNCSTART`/`QUERY`, 12.5). The payload is the `data` of
 * `inlinefunc`: `['query', { attribute }]`.
 *
 * @see ADR 026 (Markdown as the going-forward format)
 * @see packages/core/src/richtext/rich-text-syntax-rules.ts (`wordWithQueries`)
 */

import type { Extraction, MdastNode, } from "../types.ts";
import { placeholderFor, walkAndExpand, } from "./placeholders.ts";

/** Extraction of a `<-attribute->` (13.7.2). */
export interface MiniQueryExtraction {
  placeholder: string;
  attribute: string;
  /** Original text (`<-effort->`). */
  source: string;
}

/** `<-identifier->` (13.7.2). */
const MINI_QUERY_RE = /<-([a-zA-Z][_a-zA-Z0-9]*)->/g;

/** Replaces `<-name->` with `§MINIQ_n§` (13.7.2, 13.7.3). */
export function preprocessMiniQueries(
  text: string,
  startIndex = 0,
): { text: string; extractions: MiniQueryExtraction[] } {
  const extractions: MiniQueryExtraction[] = [];
  let index = startIndex;
  const out = text.replace(MINI_QUERY_RE, (match, attribute: string,) => {
    const placeholder = placeholderFor("MINIQ", index++,);
    extractions.push({ placeholder, attribute, source: match, },);
    return placeholder;
  },);
  return { text: out, extractions, };
}

/** `['query', { attribute }]` — the `data` of `inlinefunc` (13.7.4). */
export function miniQueryToExtraction(e: MiniQueryExtraction,): Extraction {
  return {
    placeholder: e.placeholder,
    category: "inlinefunc",
    payload: ["query", { attribute: e.attribute, },],
    source: e.source,
  };
}

/** Replaces the mini-query placeholders with `richtextExtension` nodes. */
export function postprocessMiniQueries(
  node: MdastNode,
  extractions: MiniQueryExtraction[],
  options: {
    isKnownFunction?: (name: string,) => boolean;
    isBlockFunction?: (name: string,) => boolean;
  } = {},
): MdastNode {
  return walkAndExpand(
    node,
    extractions.map(miniQueryToExtraction,),
    options,
  );
}
