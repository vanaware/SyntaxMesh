/**
 * Node list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:NodeListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Node list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:NodeListAttribute
 */
export class NodeListAttribute
  extends ListAttributeBase<{ id: string; name: string }> {
  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:NodeListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.map((item,) => item.id).join(", ",) : "";
  }
}
