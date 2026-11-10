/**
 * Real format attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RealFormatAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Real format attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RealFormatAttribute
 */
export class RealFormatAttribute extends AttributeBase<unknown> {
  /**
   * Attribute type ID for RealFormatAttribute.
   */
  static readonly tjpId = "realformat";

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RealFormatAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.get()}`;
  }
}
