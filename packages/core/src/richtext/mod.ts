/**
 * Barrel of the RichText subsystem (phase 12).
 *
 * Exports classes incrementally as sub-phases 12.x land. The port interface
 * `RichTextIntermediate` (in `attributes/rich/rich-text-port.ts`) is implemented
 * by the real `RichTextIntermediate` (12.4) once available.
 *
 * @see ADR 025 (RichText e function handlers)
 */

export type { XMLElementLike, } from "../xml/xml-element-like.ts";
export { XMLElement, } from "../xml/xml-element.ts";
export { RichTextImage, } from "./rich-text-image.ts";
export type { RichTextFunctionArgs, } from "./handlers/function-handler.ts";
export { RichTextFunctionHandler, } from "./handlers/function-handler.ts";
export type {
  RichTextCategory,
  RichTextFuncData,
} from "./rich-text-element.ts";
export { RichTextElement, } from "./rich-text-element.ts";
export { RichTextIntermediate, } from "./rich-text-intermediate.ts";
export { RichTextScanner, } from "./rich-text-scanner.ts";
export { RichTextParser, } from "./rich-text-parser.ts";
export { TOCEntry, } from "./toc-entry.ts";
export { TableOfContents, } from "./table-of-contents.ts";
export { RichTextSnip, } from "./rich-text-snip.ts";
export { RichTextDocument, } from "./rich-text-document.ts";
export { RTFWithQuerySupport, } from "./handlers/rtf-with-query-support.ts";
export { RTFQuery, } from "./handlers/rtf-query.ts";
export { RTFReport, } from "./handlers/rtf-report.ts";
export { RTFReportLink, } from "./handlers/rtf-report-link.ts";
export { RTFNavigator, } from "./handlers/rtf-navigator.ts";
export { RTFHandlers, } from "./handlers/rtf-handlers.ts";
export type { ExampleLoader, } from "./handlers/function-example.ts";
export { RichTextFunctionExample, } from "./handlers/function-example.ts";
export { RichText, } from "./rich-text.ts";
export type { RichTextFactory, } from "./factory.ts";
export { RichTextFactoryImpl, } from "./factory.ts";
