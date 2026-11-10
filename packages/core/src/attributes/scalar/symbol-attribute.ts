/**
 * Symbol scalar attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SymbolAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Symbol scalar attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SymbolAttribute
 */
export class SymbolAttribute extends AttributeBase<string> {
  /**
   * Attribute type ID for SymbolAttribute.
   */
  static readonly tjpId = "symbol";

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SymbolAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.get()}`;
  }
}
