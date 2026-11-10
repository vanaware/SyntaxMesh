/**
 * richTextToMarkdown — one-way converter from RichText (MediaWiki) to Markdown
 * (phase 13.10).
 *
 * Receives RichText markup as a string, creates a `RichTextIntermediate` via the
 * phase 12 factory, and calls `to_markdown()` on the resulting tree. The output
 * is Markdown with the extensions preserved (`<fcol:…>`, `[[func:…]]`,
 * `<-…->`).
 *
 * Round-trip is not guaranteed: RichText has constructs without a direct
 * Markdown equivalent (e.g. `__NOEDITSECTION__`). The conversion is
 * best-effort.
 *
 * @see ADR 026 (Markdown as the going-forward format)
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.10)
 */

import { RichText, } from "../richtext/rich-text.ts";
import { RTFHandlers, } from "../richtext/handlers/rtf-handlers.ts";
import type { RichTextIntermediate, } from "../richtext/rich-text-intermediate.ts";

/** Regex: 3+ consecutive line breaks. */
const MULTI_NL = new RegExp("\\n{3,}", "g",);

/**
 * Converts RichText markup to Markdown.
 *
 * @param richText MediaWiki/TaskJuggler markup (string).
 * @param header if `true`, prefixes `<!-- converted from RichText -->`.
 * @returns Markdown with the extensions preserved.
 */
export function richTextToMarkdown(
  richText: string,
  header = false,
): string {
  const rt = new RichText(richText, RTFHandlers.create(null,),);
  const rti: RichTextIntermediate | null = rt.generateIntermediateFormat(
    [0, 0, 0,],
    null,
  );
  if (!rti) return "";
  const md = rti.to_markdown();
  // Colapsa 3+ newlines para 2, e garante newline final.
  const trimmed = md.replace(MULTI_NL, "\n\n",).trimEnd() + "\n";
  return header ? `<!-- converted from RichText -->\n\n${trimmed}` : trimmed;
}
