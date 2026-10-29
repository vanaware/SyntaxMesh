/**
 * Barrel do subsistema RichText (Fase 12).
 *
 * Exporta incrementalmente as classes conforme as subfases 12.x são entregues.
 * A interface `RichTextIntermediate` de porta (em
 * `attributes/rich/rich-text-port.ts`) é implementada por
 * `RichTextIntermediate` real (12.4) quando disponível.
 *
 * @see ADR 025 (RichText e function handlers)
 */

export type { XMLElementLike, } from "./xml-like.ts";
export {
  createBlob,
  createComment,
  createText,
  SimpleXMLElement,
} from "./xml-like.ts";
export { RichTextImage, } from "./rich-text-image.ts";
export type { RichTextFunctionArgs, } from "./handlers/function-handler.ts";
export { RichTextFunctionHandler, } from "./handlers/function-handler.ts";
export type {
  RichTextCategory,
  RichTextFuncData,
} from "./rich-text-element.ts";
export { RichTextElement, } from "./rich-text-element.ts";
export { RichTextIntermediate, } from "./rich-text-intermediate.ts";
export { TOCEntry, } from "./toc-entry.ts";
export { TableOfContents, } from "./table-of-contents.ts";
