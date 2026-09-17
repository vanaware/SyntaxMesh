/**
 * Atributo de lista de formatos.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FormatListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de formatos.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FormatListAttribute
 */
export class FormatListAttribute extends ListAttributeBase<string> {
  /**
   * ID do tipo de atributo para FormatListAttribute.
   */
  static readonly tjpId = "formatlist";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FormatListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.join(", ",) : "";
  }
}
