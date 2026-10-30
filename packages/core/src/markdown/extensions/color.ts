/**
 * Extensão de cor `<fcol:red>…</fcol>` (Fase 13.4).
 *
 * Markdown não tem cor. A sintaxe é a mesma do RichText/Fase 12 (e do
 * TaskJuggler), com as mesmas 16 cores nomeadas + hex `#RGB`/`#RRGGBB`; cor
 * inválida não vira extensão — o texto fica cru, igual ao `RichTextScanner`
 * que registra o erro `bad_color_name` e segue o parse.
 *
 * @see ADR 026 (Markdown como formato going-forward)
 * @see packages/core/src/richtext/rich-text-scanner.ts (`fontColorStart`)
 */

import type { Extraction, MdastNode, } from "../types.ts";
import { placeholderFor, walkAndExpand, } from "./placeholders.ts";

/** Extração de um `<fcol:cor>conteúdo</fcol>` (13.4.2). */
export interface ColorExtraction {
  /** Placeholder deixado no texto (`§COLOR_0§`). */
  placeholder: string;
  /** Cor nomeada ou hex. */
  color: string;
  /** Conteúdo interno (pode conter outras extensões). */
  content: string;
}

/** Cores nomeadas aceitas (RichText/Scanner.rb l.155-156). */
export const NAMED_COLORS = [
  "black",
  "maroon",
  "green",
  "olive",
  "navy",
  "purple",
  "teal",
  "silver",
  "gray",
  "red",
  "lime",
  "yellow",
  "blue",
  "fuchsia",
  "aqua",
  "white",
];

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

/** Verdadeiro se `color` é nomeada (13.4.4) ou hex `#RGB`/`#RRGGBB`. */
export function isValidColor(color: string,): boolean {
  return NAMED_COLORS.includes(color.toLowerCase(),) || HEX_RE.test(color,);
}

/** `<fcol:cor>conteúdo</fcol>` (multiline, não-guloso). */
const COLOR_RE = /<fcol:([a-zA-Z]+|#[0-9A-Fa-f]{3,6})>([\s\S]*?)<\/fcol>/g;

/**
 * Troca cada `<fcol:…>…</fcol>` válido por `§COLOR_n§` e registra o conteúdo.
 *
 * @param startIndex deslocador do contador, para o pipeline manter
 *                   placeholders únicos entre passadas (13.8).
 */
export function preprocessColor(
  text: string,
  startIndex = 0,
): { text: string; extractions: ColorExtraction[] } {
  const extractions: ColorExtraction[] = [];
  let index = startIndex;
  const out = text.replace(
    COLOR_RE,
    (match, color: string, content: string,) => {
      if (!isValidColor(color,)) return match; // cor inválida → texto simples
      const placeholder = placeholderFor("COLOR", index++,);
      extractions.push({ placeholder, color, content, },);
      return placeholder;
    },
  );
  return { text: out, extractions, };
}

/** Converte a extração da extensão no `Extraction` genérico do pipeline. */
export function colorToExtraction(e: ColorExtraction,): Extraction {
  return {
    placeholder: e.placeholder,
    category: "fontCol",
    payload: e.color,
    source: `<fcol:${e.color}>${e.content}</fcol>`,
    content: e.content,
  };
}

/** Substitui os placeholders de cor por nós `richtextExtension` (13.4.5). */
export function postprocessColor(
  node: MdastNode,
  extractions: ColorExtraction[],
): MdastNode {
  return walkAndExpand(node, extractions.map(colorToExtraction,),);
}
