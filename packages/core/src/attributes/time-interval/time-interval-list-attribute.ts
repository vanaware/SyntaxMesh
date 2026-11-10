/**
 * Time interval list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TimeIntervalListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Time interval list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TimeIntervalListAttribute
 */
export class TimeIntervalListAttribute
  extends ListAttributeBase<{ to_s(): string }> {
  /**
   * Attribute type ID for TimeIntervalListAttribute.
   */
  static readonly tjpId = "intervallist";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TimeIntervalListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const item of val) {
        out.push(item.to_s(),);
      }
    }
    return out.join(", ",);
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TimeIntervalListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const item of val) {
        out.push(item.to_s(),);
      }
    }
    return `${this.tjpId} ${out.join(", ",)}`;
  }
}
