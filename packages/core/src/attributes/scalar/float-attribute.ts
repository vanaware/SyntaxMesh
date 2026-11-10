/**
 * Float scalar attribute (number).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FloatAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Float scalar attribute (number).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FloatAttribute
 */
export class FloatAttribute extends AttributeBase<number> {
  /**
   * Attribute type ID for FloatAttribute.
   */
  static readonly tjpId = "number";

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FloatAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.get()}`;
  }
}
