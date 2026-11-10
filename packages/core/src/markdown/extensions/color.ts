/**
 * Color extension `<fcol:red>…</fcol>` (phase 13.4).
 *
 * Markdown has no color. The syntax is the same as RichText/phase 12 (and
 * TaskJuggler), with the same 16 named colors plus hex `#RGB`/`#RRGGBB`; an
 * invalid color does not become an extension — the text stays raw, just like
 * `RichTextScanner`, which logs the `bad_color_name` error and keeps parsing.
 *
 * @see ADR 026 (Markdown as the going-forward format)
 * @see packages/core/src/richtext/rich-text-scanner.ts (`fontColorStart`)
 */

import type { Extraction, MdastNode, } from "../types.ts";
import { placeholderFor, walkAndExpand, } from "./placeholders.ts";

/** Extraction of an `<fcol:color>content</fcol>` (13.4.2). */
export interface ColorExtraction {
  /** Placeholder left in the text (`§COLOR_0§`). */
  placeholder: string;
  /** Named or hex color. */
  color: string;
  /** Inner content (may contain other extensions). */
  content: string;
}

/** Accepted named colors (RichText/Scanner.rb l.155-156). */
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

/** True when `color` is named (13.4.4) or hex `#RGB`/`#RRGGBB`. */
export function isValidColor(color: string,): boolean {
  return NAMED_COLORS.includes(color.toLowerCase(),) || HEX_RE.test(color,);
}

/** `<fcol:color>content</fcol>` (multiline, non-greedy). */
const COLOR_RE = /<fcol:([a-zA-Z]+|#[0-9A-Fa-f]{3,6})>([\s\S]*?)<\/fcol>/g;

/**
 * Replaces each valid `<fcol:…>…</fcol>` with `§COLOR_n§` and records the content.
 *
 * @param startIndex offset of the counter, so the pipeline keeps placeholders
 *                   unique across passes (13.8).
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
      if (!isValidColor(color,)) return match; // invalid color → plain text
      const placeholder = placeholderFor("COLOR", index++,);
      extractions.push({ placeholder, color, content, },);
      return placeholder;
    },
  );
  return { text: out, extractions, };
}

/** Converts the extension extraction into the pipeline's generic `Extraction`. */
export function colorToExtraction(e: ColorExtraction,): Extraction {
  return {
    placeholder: e.placeholder,
    category: "fontCol",
    payload: e.color,
    source: `<fcol:${e.color}>${e.content}</fcol>`,
    content: e.content,
  };
}

/** Replaces the color placeholders with `richtextExtension` nodes (13.4.5). */
export function postprocessColor(
  node: MdastNode,
  extractions: ColorExtraction[],
): MdastNode {
  return walkAndExpand(node, extractions.map(colorToExtraction,),);
}
