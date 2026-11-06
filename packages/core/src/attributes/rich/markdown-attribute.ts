/**
 * Atributo dinâmico em Markdown (extensão SyntaxMesh — ADR 039).
 *
 * Idêntico ao `RichTextAttribute` em contrato (o valor é sempre um
 * `RichTextIntermediate`, produzido aqui pela `MarkdownFactory` no parser);
 * muda apenas o **dialeto de origem** do texto, que precisa ser preservado na
 * declaração de `extend` do TJP-export (`objClass.tjpId`, 14C.18/C5.7).
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento3.md
 * @see docs/syntaxmesh/decisoes/039-extend-markdown.md
 */

import { RichTextAttribute, } from "./rich-text-attribute.ts";

/**
 * Atributo `markdown` de `extend`. Herda todo o comportamento de
 * `RichTextAttribute` (`to_s`/`to_tjp`/`inputText` via RTI); só declara o
 * `tjpId` usado na reimpressão da declaração `extend`.
 */
export class MarkdownAttribute extends RichTextAttribute {
  /**
   * ID do tipo de atributo para MarkdownAttribute (extensão; não existe no TJ).
   */
  static override readonly tjpId = "markdown";
}
