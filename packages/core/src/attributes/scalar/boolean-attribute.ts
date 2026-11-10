/**
 * Boolean scalar attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BooleanAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Boolean scalar attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BooleanAttribute
 */
export class BooleanAttribute extends AttributeBase<boolean> {
  /**
   * Attribute type ID for BooleanAttribute.
   */
  static readonly tjpId = "boolean";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BooleanAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? "true" : "false";
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BooleanAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    return `${this.type.id} ${val ? "yes" : "no"}`;
  }
}
