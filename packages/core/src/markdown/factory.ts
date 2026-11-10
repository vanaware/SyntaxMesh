/**
 * MarkdownFactory — implements `RichTextFactory` through the Markdown pipeline
 * (13.3).
 *
 * It takes Markdown text, pre/post-processes the extensions, parses the `mdast`,
 * converts it to `RichTextElement[]` and assembles the `RichTextIntermediate`.
 * It is the entry interface of the Markdown subsystem into the RichText
 * ecosystem (phase 12).
 *
 * It registers the `RTFHandlers.create(project, sfi)` handlers on the outgoing
 * RTI, so that `inlinefunc`/`blockfunc` can be resolved in `to_s()`/`to_html()`.
 *
 * @see ADR 026 (Markdown as the going-forward format)
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

/** Rich text factory that reads Markdown source. */
export class MarkdownFactory implements RichTextFactory {
  private readonly project: Project | null;
  private readonly sourceFileInfo: SourceFileInfo | null;

  /**
   * Creates the factory.
   *
   * @param project Project used to resolve query/report handlers, or `null`.
   * @param sourceFileInfo Source location attached to reported errors.
   */
  constructor(
    project: Project | null,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    this.project = project;
    this.sourceFileInfo = sourceFileInfo;
  }

  /**
   * Full pipeline: preprocess → parseMdast → postprocess → convert.
   *
   * @param text Markdown source text.
   * @param _tokenSet Unused; kept for `RichTextFactory` compatibility.
   * @returns The intermediate representation with its tree and handlers.
   */
  create(text: string, _tokenSet?: string[] | null,): RichTextIntermediate {
    const pipeline = new ExtractionPipeline();
    const preprocessed = pipeline.preprocess(text,);
    const mdast = parseMdast(preprocessed,);
    const postprocessed = pipeline.postprocessMdast(mdast,);
    // C5.7 (ADR 039): the RTI `richText` back-pointer carries the source text —
    // `RichTextAttribute#to_tjp` (faithful to Ruby) reads `inputText` for the
    // export round-trip. The shim keeps `this` as the factory for consumers that
    // recreate the RTI (report-base 14C.5.7 keeps the RichText instance, so
    // markdown is never reconverted by mistake).
    return this.buildRti(postprocessed, text,);
  }

  /**
   * Variant that takes an already parsed `mdast` (skips preprocess + parse).
   *
   * @param mdast Post-processed Markdown AST.
   * @returns The intermediate representation of the AST.
   */
  createFromMdast(mdast: MdastRoot,): RichTextIntermediate {
    return this.buildRti(mdast, "",);
  }

  /**
   * Assembles the RTI from the post-processed AST.
   *
   * @param mdast Post-processed Markdown AST.
   * @param sourceText Original Markdown text stored as `inputText`.
   * @returns The intermediate representation with the standard handlers.
   */
  private buildRti(
    mdast: MdastRoot,
    sourceText: string,
  ): RichTextIntermediate {
    const rti = new RichTextIntermediate({
      factory: this,
      inputText: sourceText,
    },);
    // Registers the standard handlers (query, report, reportlink, navigator).
    for (
      const handler of RTFHandlers.create(this.project, this.sourceFileInfo,)
    ) {
      rti.registerFunctionHandler(handler,);
    }
    // Converts the AST into elements.
    const converter = new MdastToRichText(rti,);
    const elements = converter.convert(mdast,);
    // Wraps everything in the `richtext` root.
    rti.tree = new RichTextElement(rti, "richtext", elements,);
    return rti;
  }
}
