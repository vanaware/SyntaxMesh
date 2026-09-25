/**
 * Atributo escalar de texto.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:StringAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Atributo escalar de texto.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:StringAttribute
 */
export class StringAttribute extends AttributeBase<string> {
  /**
   * ID do tipo de atributo para StringAttribute.
   */
  static readonly tjpId = "text";

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:StringAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.quotedString(this.to_s())}`;
  }
}
