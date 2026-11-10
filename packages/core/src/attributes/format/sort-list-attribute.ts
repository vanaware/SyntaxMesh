/**
 * Sort list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SortListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Sort list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SortListAttribute
 */
export class SortListAttribute extends ListAttributeBase<unknown> {
  /**
   * Attribute type ID for SortListAttribute.
   */
  static readonly tjpId = "sorting";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SortListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.join(", ",) : "";
  }
}
