/**
 * Account reference attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Account reference attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountAttribute
 */
export class AccountAttribute extends AttributeBase<{ id: string }> {
  /**
   * Attribute type ID for AccountAttribute.
   */
  static readonly tjpId = "account";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.id : "";
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    return val ? val.id : "";
  }
}
