/**
 * Flag list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FlagListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Flag list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FlagListAttribute
 */
export class FlagListAttribute extends ListAttributeBase<string> {
  /**
   * Attribute type ID for FlagListAttribute.
   */
  static readonly tjpId = "flaglist";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FlagListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.join(", ",) : "";
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FlagListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    return `flags ${val ? val.join(", ",) : ""}`;
  }
}
