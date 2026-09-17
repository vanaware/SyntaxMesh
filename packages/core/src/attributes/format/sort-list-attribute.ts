/**
 * Atributo de lista de ordenação.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SortListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de ordenação.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SortListAttribute
 */
export class SortListAttribute extends ListAttributeBase<unknown> {
  /**
   * ID do tipo de atributo para SortListAttribute.
   */
  static readonly tjpId = "sorting";
}
