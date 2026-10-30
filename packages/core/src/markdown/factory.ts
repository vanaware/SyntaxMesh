/**
 * MarkdownFactory — implementa `RichTextFactory` via pipeline Markdown (13.3).
 *
 * Recebe texto Markdown, pré/pós-processa extensões, parseia `mdast`, converte
 * para `RichTextElement[]` e monta o `RichTextIntermediate`. É a interface de
 * entrada do subsistema Markdown no ecossistema RichText/Fase 12.
 *
 * Registra os handlers `RTFHandlers.create(project, sfi)` no RTI de saída, de
 * modo que `inlinefunc`/`blockfunc` possam ser resolvidos em `to_s()`/`to_html()`.
 *
 * @see ADR 026 (Markdown como formato going-forward)
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.3)
 */

import type { RichTextFactory, } from "../richtext/factory.ts";
import { RichTextIntermediate, } from "../richtext/rich-text-intermediate.ts";
import { RichTextElement, } from "../richtext/rich-text-element.ts";
import { RTFHandlers, } from "../richtext/handlers/rtf-handlers.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import type { Project, } from "../model/project.ts";
import { ExtractionPipeline, } from "./extensions/pipeline.ts";
import { parseMdast, } from "./parse-mdast.ts";
import { MdastToRichText, } from "./mdast-to-richtext.ts";
import type { MdastRoot, } from "./types.ts";

export class MarkdownFactory implements RichTextFactory {
  private readonly project: Project | null;
  private readonly sourceFileInfo: SourceFileInfo | null;

  constructor(
    project: Project | null,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    this.project = project;
    this.sourceFileInfo = sourceFileInfo;
  }

  /**
   * Pipeline completo: pré-processar → parseMdast → pós-processar → converter.
   * Devolve um `RichTextIntermediate` com a árvore e handlers registrados.
   */
  create(text: string, _tokenSet?: string[] | null,): RichTextIntermediate {
    const pipeline = new ExtractionPipeline();
    const preprocessed = pipeline.preprocess(text,);
    const mdast = parseMdast(preprocessed,);
    const postprocessed = pipeline.postprocessMdast(mdast,);
    return this.buildRti(postprocessed,);
  }

  /** Variante que aceita `mdast` já parseada (pula preprocess+parse). */
  createFromMdast(mdast: MdastRoot,): RichTextIntermediate {
    return this.buildRti(mdast,);
  }

  /** Monta o RTI a partir da AST pós-processada. */
  private buildRti(mdast: MdastRoot,): RichTextIntermediate {
    const rti = new RichTextIntermediate(this,);
    // Registra handlers padrão (query, report, reportlink, navigator).
    for (
      const handler of RTFHandlers.create(this.project, this.sourceFileInfo,)
    ) {
      rti.registerFunctionHandler(handler,);
    }
    // Converte AST → elementos.
    const converter = new MdastToRichText(rti,);
    const elements = converter.convert(mdast,);
    // Envelopa em raiz `richtext`.
    rti.tree = new RichTextElement(rti, "richtext", elements,);
    return rti;
  }
}
