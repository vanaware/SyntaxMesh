/**
 * Property reference attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:PropertyAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Property reference attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:PropertyAttribute
 */
export class PropertyAttribute extends AttributeBase<PropertyLike> {
  /**
   * Attribute type ID for PropertyAttribute.
   */
  static readonly tjpId = "property";
}
