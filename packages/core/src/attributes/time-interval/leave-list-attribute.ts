/**
 * Leave list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LeaveListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type Leave, } from "../../model/leave.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Leave list attribute.
 *
 * Ruby `LeaveListAttribute#to_tjp` → `"leaves #{get.join(",\n")}"`, where
 * each `Leave#to_s` already carries type/reason/interval.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LeaveListAttribute
 */
export class LeaveListAttribute extends ListAttributeBase<Leave> {
  /**
   * Attribute type ID for LeaveListAttribute.
   */
  static readonly tjpId = "leave";

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LeaveListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    return `leaves ${val ? val.join(",\n",) : ""}`;
  }
}
