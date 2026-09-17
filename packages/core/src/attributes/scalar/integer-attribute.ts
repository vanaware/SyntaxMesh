/**
 * Atributo escalar inteiro.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:IntegerAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Atributo escalar inteiro.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:IntegerAttribute
 */
export class IntegerAttribute extends AttributeBase<number> {
  /**
   * ID do tipo de atributo para IntegerAttribute.
   */
  static readonly tjpId = "integer";

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_tjp
   */
  override to_tjp(): string {
    return `${this.type.id} ${this.get()}`;
  }
}
