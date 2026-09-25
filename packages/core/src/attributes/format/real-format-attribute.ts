/**
 * Atributo de formato real.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RealFormatAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Atributo de formato real.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RealFormatAttribute
 */
export class RealFormatAttribute extends AttributeBase<unknown> {
  /**
   * ID do tipo de atributo para RealFormatAttribute.
   */
  static readonly tjpId = "realformat";

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RealFormatAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.get()}`;
  }
}
