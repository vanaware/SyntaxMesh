/**
 * Charge list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ChargeListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Charge list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ChargeListAttribute
 */
export class ChargeListAttribute extends ListAttributeBase<{ amount: number }> {
  /**
   * Attribute type ID for ChargeListAttribute.
   */
  static readonly tjpId = "charge";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ChargeListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const item of val) {
        out.push(item.amount.toString(),);
      }
    }
    return out.join(", ",);
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ChargeListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const item of val) {
        out.push(item.amount.toString(),);
      }
    }
    return `${this.tjpId} ${out.join(", ",)}`;
  }
}
