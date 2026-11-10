/**
 * Task list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Task list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskListAttribute
 */
export class TaskListAttribute
  extends ListAttributeBase<{ id: string; name: string; fullId?: string }> {
  /**
   * Attribute type ID for TaskListAttribute.
   */
  static readonly tjpId = "tasklist";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.map((item,) => item.fullId).join(", ",) : "";
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    const out = val ? val.map((item,) => item.fullId) : [];
    return `${this.type.id} ${out.join(", ",)}`;
  }
}
