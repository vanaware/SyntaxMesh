/**
 * Format list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FormatListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Format list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FormatListAttribute
 */
export class FormatListAttribute extends ListAttributeBase<string> {
  /**
   * Attribute type ID for FormatListAttribute.
   */
  static readonly tjpId = "formatlist";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FormatListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.join(", ",) : "";
  }
}
