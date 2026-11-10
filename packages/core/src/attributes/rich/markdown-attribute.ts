/**
 * Dynamic attribute in Markdown (SyntaxMesh extension — ADR 039).
 *
 * Identical to `RichTextAttribute` in contract (the value is always a
 * `RichTextIntermediate`, produced here by the `MarkdownFactory` in the
 * parser); only the **source dialect** of the text differs, and it has to be
 * preserved in the `extend` declaration of the TJP-export (`objClass.tjpId`,
 * 14C.18/C5.7).
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento3.md
 * @see docs/syntaxmesh/decisoes/039-extend-markdown.md
 */

import { RichTextAttribute, } from "./rich-text-attribute.ts";

/**
 * `markdown` attribute of `extend`. Inherits all the behavior of
 * `RichTextAttribute` (`to_s`/`to_tjp`/`inputText` via RTI); it only declares
 * the `tjpId` used when reprinting the `extend` declaration.
 */
export class MarkdownAttribute extends RichTextAttribute {
  /**
   * Attribute type ID for MarkdownAttribute (extension; absent in TJ).
   */
  static override readonly tjpId = "markdown";
}
