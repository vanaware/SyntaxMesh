/**
 * Atributo de lista de créditos de conta.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountCreditListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de créditos de conta.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountCreditListAttribute
 */
export class AccountCreditListAttribute extends ListAttributeBase<unknown> {
  /**
   * ID do tipo de atributo para AccountCreditListAttribute.
   */
  static readonly tjpId = "credits";
}
