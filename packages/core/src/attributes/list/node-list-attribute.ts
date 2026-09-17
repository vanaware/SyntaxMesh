/**
 * Atributo de lista de nós.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:NodeListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de nós.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:NodeListAttribute
 */
export class NodeListAttribute
  extends ListAttributeBase<{ id: string; name: string }> {
  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:NodeListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.map((item,) => item.id).join(", ",) : "";
  }
}
