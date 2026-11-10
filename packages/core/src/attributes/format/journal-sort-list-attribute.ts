/**
 * Journal sort list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:JournalSortListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Journal sort list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:JournalSortListAttribute
 */
export class JournalSortListAttribute extends ListAttributeBase<unknown> {
  /**
   * Attribute type ID for JournalSortListAttribute.
   */
  static readonly tjpId = "journalsorting";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:JournalSortListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.join(", ",) : "";
  }
}
