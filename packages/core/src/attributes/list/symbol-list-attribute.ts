/**
 * Symbol list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SymbolListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Symbol list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SymbolListAttribute
 */
export class SymbolListAttribute extends ListAttributeBase<string> {
  /**
   * Attribute type ID for SymbolListAttribute.
   */
  static readonly tjpId = "symbollist";

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SymbolListAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.get()?.join(", ",) ?? ""}`;
  }
}
