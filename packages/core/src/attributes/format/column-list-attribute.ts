/**
 * Atributo de lista de colunas.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ColumnListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de colunas.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ColumnListAttribute
 */
export class ColumnListAttribute extends ListAttributeBase<string> {
  /**
   * ID do tipo de atributo para ColumnListAttribute.
   */
  static readonly tjpId = "columns";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ColumnListAttribute#to_s
   */
  override to_s(): string {
    return "TODO";
  }
}
