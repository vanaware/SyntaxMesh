/**
 * Barrel export of the Markdown subsystem (phase 13).
 *
 * @see ADR 026 (Markdown as the going-forward format)
 */

export { parseMdast, parseMdastInline, } from "./parse-mdast.ts";
export { MdastToRichText, } from "./mdast-to-richtext.ts";
export { MarkdownFactory, } from "./factory.ts";
export { richTextToMarkdown, } from "./convert-rich-to-md.ts";
export { ExtractionPipeline, } from "./extensions/pipeline.ts";
export { sanitizeHtml, } from "./extensions/html-sanitizer.ts";
export { isExternalImageRef, resolveImageRef, } from "./extensions/images.ts";
export type {
  ImageOrigin,
  ImageStore,
  ResolvedImage,
  ResolveOptions,
} from "./extensions/images.ts";
export type {
  ExtensionCategory,
  Extraction,
  MdastBlock,
  MdastExtension,
  MdastInline,
  MdastNode,
  MdastRoot,
} from "./types.ts";
