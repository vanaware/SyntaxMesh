/**
 * Atributo de referência à propriedade.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:PropertyAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Atributo de referência à propriedade.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:PropertyAttribute
 */
export class PropertyAttribute extends AttributeBase<PropertyLike> {
  /**
   * ID do tipo de atributo para PropertyAttribute.
   */
  static readonly tjpId = "property";
}
