/**
 * Atributo de texto rico.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RichTextAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";
import { type RichTextIntermediate, } from "./rich-text-port.ts";

/**
 * Atributo de texto rico.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RichTextAttribute
 */
export class RichTextAttribute extends AttributeBase<unknown> {
  /**
   * ID do tipo de atributo para RichTextAttribute.
   */
  // `string` (não o literal) para permitir que MarkdownAttribute sobrescreva
  // com `override` (C5.3, ADR 039) sem violar a tipagem estática da classe.
  static readonly tjpId: string = "richtext";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RichTextAttribute#to_s
   */
  override to_s(): string {
    const val = this.get() as RichTextIntermediate | null;
    return val ? val.to_s() : "";
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RichTextAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get() as RichTextIntermediate | null;
    return `${this.type.id} ${
      this.quotedString(val?.richText.inputText ?? "",)
    }`;
  }
}
