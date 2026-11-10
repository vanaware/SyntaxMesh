/**
 * Text scalar attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:StringAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Text scalar attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:StringAttribute
 */
export class StringAttribute extends AttributeBase<string> {
  /**
   * Attribute type ID for StringAttribute.
   */
  static readonly tjpId = "text";

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:StringAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.quotedString(this.to_s(),)}`;
  }
}
