/**
 * Atributo de lista de definições.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DefinitionListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de definições.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DefinitionListAttribute
 */
export class DefinitionListAttribute extends ListAttributeBase<unknown> {
  /**
   * ID do tipo de atributo para DefinitionListAttribute.
   */
  static readonly tjpId = "definitionlist";

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DefinitionListAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.to_s()}`;
  }
}
