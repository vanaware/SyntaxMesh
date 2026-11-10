/**
 * Integer scalar attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:IntegerAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Integer scalar attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:IntegerAttribute
 */
export class IntegerAttribute extends AttributeBase<number> {
  /**
   * Attribute type ID for IntegerAttribute.
   */
  static readonly tjpId = "integer";

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_tjp
   */
  override to_tjp(): string {
    return `${this.type.id} ${this.get()}`;
  }
}
