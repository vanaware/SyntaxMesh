/**
 * Atributo escalar float (número).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FloatAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Atributo escalar float (número).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FloatAttribute
 */
export class FloatAttribute extends AttributeBase<number> {
  /**
   * ID do tipo de atributo para FloatAttribute.
   */
  static readonly tjpId = "number";

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FloatAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.type.id} ${this.get()}`;
  }
}
