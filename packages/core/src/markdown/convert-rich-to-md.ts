/**
 * richTextToMarkdown — conversor one-way de RichText (MediaWiki) para Markdown
 * (Fase 13.10).
 *
 * Recebe markup RichText como string, cria um `RichTextIntermediate` via a
 * fábrica da Fase 12, e chama `to_markdown()` na árvore resultante. O output é
 * Markdown com extensões preservadas (`<fcol:…>`, `[[func:…]]`, `<-…->`).
 *
 * Não é round-trip garantido: RichText tem constructs sem equivalente
 * Markdown direto (ex.: `__NOEDITSECTION__`). A conversão é melhor-esforço.
 *
 * @see ADR 026 (Markdown como formato going-forward)
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.10)
 */

import { RichText, } from "../richtext/rich-text.ts";
import { RTFHandlers, } from "../richtext/handlers/rtf-handlers.ts";
import type { RichTextIntermediate, } from "../richtext/rich-text-intermediate.ts";

/** Regex: 3+ quebras de linha consecutivas. */
const MULTI_NL = new RegExp("\\n{3,}", "g",);

/**
 * Converte markup RichText para Markdown.
 *
 * @param richText markup MediaWiki/TaskJuggler (string).
 * @param header se `true`, prefixa `<!-- converted from RichText -->`.
 * @returns Markdown com extensões preservadas.
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
