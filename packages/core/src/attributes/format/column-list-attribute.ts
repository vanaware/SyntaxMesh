/**
 * Column list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ColumnListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Column list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ColumnListAttribute
 */
export class ColumnListAttribute extends ListAttributeBase<string> {
  /**
   * Attribute type ID for ColumnListAttribute.
   */
  static readonly tjpId = "columns";

  /**
   * Converts the value to a string.
   *
   * Faithful to Ruby: `ColumnListAttribute#to_s` literally returns the string
   * "TODO" upstream (Attributes.rb:196-198 — never implemented there; the
   * columns are dumped through `to_tjp`, not through `to_s`). It is not a gap of
   * ours: changing it would deviate from the reference behavior.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ColumnListAttribute#to_s
   */
  override to_s(): string {
    return "TODO";
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ColumnListAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.get()?.join(", ",) ?? ""}`;
  }
}
