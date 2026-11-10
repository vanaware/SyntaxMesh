/**
 * Account credit list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountCreditListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Account credit list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountCreditListAttribute
 */
export class AccountCreditListAttribute
  extends ListAttributeBase<{ amount: number }> {
  /**
   * Attribute type ID for AccountCreditListAttribute.
   */
  static readonly tjpId = "credits";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountCreditListAttribute#to_s
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
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountCreditListAttribute#to_tjp
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
