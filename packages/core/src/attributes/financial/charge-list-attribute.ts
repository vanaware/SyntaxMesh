/**
 * Atributo de lista de cobranças.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ChargeListAttribute
 */

import { type PropertyLike } from "../../model/property-like.ts";
import { type AttributeContainer } from "../attribute-container.ts";
import { type AttributeDefinition } from "../attribute-definition.ts";
import { ListAttributeBase } from "../list-attribute-base.ts";

/**
 * Atributo de lista de cobranças.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ChargeListAttribute
 */
export class ChargeListAttribute extends ListAttributeBase<string> {
  /**
   * ID do tipo de atributo para ChargeListAttribute.
   */
  static readonly tjpId = "charge";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ChargeListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.join(", ") : "";
  }
}