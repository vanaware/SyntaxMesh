/**
 * Extensão de mini-queries `<-nome->` (Fase 13.7).
 *
 * Equivalente açucarado de `[[query:attribute=nome]]` (13.6), e a mesma
 * sintaxe do RichText (`INLINEFUNCSTART`/`QUERY`, 12.5). O payload é o `data`
 * de `inlinefunc`: `['query', { attribute }]`.
 *
 * @see ADR 026 (Markdown como formato going-forward)
 * @see packages/core/src/richtext/rich-text-syntax-rules.ts (`wordWithQueries`)
 */

import type { Extraction, MdastNode, } from "../types.ts";
import { placeholderFor, walkAndExpand, } from "./placeholders.ts";

/** Extração de um `<-attribute->` (13.7.2). */
export interface MiniQueryExtraction {
  placeholder: string;
  attribute: string;
  /** Texto original (`<-effort->`). */
  source: string;
}

/** `<-identificador->` (13.7.2). */
const MINI_QUERY_RE = /<-([a-zA-Z][_a-zA-Z0-9]*)->/g;

/** Troca `<-nome->` por `§MINIQ_n§` (13.7.2, 13.7.3). */
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

/** `['query', { attribute }]` — o `data` de `inlinefunc` (13.7.4). */
export function miniQueryToExtraction(e: MiniQueryExtraction,): Extraction {
  return {
    placeholder: e.placeholder,
    category: "inlinefunc",
    payload: ["query", { attribute: e.attribute, },],
    source: e.source,
  };
}

/** Substitui os placeholders de mini-query por nós `richtextExtension`. */
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
