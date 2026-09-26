/**
 * Atributo de lista de ordenação.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SortListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de ordenação.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SortListAttribute
 */
export class SortListAttribute extends ListAttributeBase<unknown> {
  /**
   * ID do tipo de atributo para SortListAttribute.
   */
  static readonly tjpId = "sorting";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SortListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.join(", ",) : "";
  }
}
