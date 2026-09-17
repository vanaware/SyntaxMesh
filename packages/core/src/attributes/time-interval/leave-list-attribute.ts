/**
 * Atributo de lista de licenças.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LeaveListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de licenças.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LeaveListAttribute
 */
export class LeaveListAttribute extends ListAttributeBase<string> {
  /**
   * ID do tipo de atributo para LeaveListAttribute.
   */
  static readonly tjpId = "leave";

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LeaveListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    return `leaves ${val ? val.join(",\n",) : ""}`;
  }
}
