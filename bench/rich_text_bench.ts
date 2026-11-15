/**
 * Benchmark de RichText (F21¹, 26.11.5).
 *
 * Mede as três saídas do formato intermediário MediaWiki (Fase 12) sobre uma
 * amostra representativa: texto (`to_s`), HTML (`to_html`) e tagged. Cada
 * iteração re-parseia o markup para refletir o uso real.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.11)
 */
import { RichText, } from "../packages/core/src/richtext/rich-text.ts";
import { RICH_TEXT_SAMPLE, } from "./workloads.ts";

Deno.bench({ name: "richtext_to_s", group: "richtext", }, () => {
  new RichText(RICH_TEXT_SAMPLE,).generateIntermediateFormat()!.to_s();
},);

Deno.bench({ name: "richtext_to_html", group: "richtext", }, () => {
  new RichText(RICH_TEXT_SAMPLE,).generateIntermediateFormat()!.to_html()
    ?.toHTML();
},);

Deno.bench({ name: "richtext_to_tagged", group: "richtext", }, () => {
  new RichText(RICH_TEXT_SAMPLE,).generateIntermediateFormat()!.to_tagged();
},);
