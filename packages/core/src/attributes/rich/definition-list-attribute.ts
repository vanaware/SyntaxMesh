/**
 * Definition list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DefinitionListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Definition list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DefinitionListAttribute
 */
export class DefinitionListAttribute extends ListAttributeBase<unknown> {
  /**
   * Attribute type ID for DefinitionListAttribute.
   */
  static readonly tjpId = "definitionlist";

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DefinitionListAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.to_s()}`;
  }
}
