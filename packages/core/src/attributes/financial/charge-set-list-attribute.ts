/**
 * Atributo de lista de conjuntos de cobranças.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ChargeSetListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de conjuntos de cobranças.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ChargeSetListAttribute
 */
export class ChargeSetListAttribute
  extends ListAttributeBase<{ to_s(): string }> {
  /**
   * ID do tipo de atributo para ChargeSetListAttribute.
   */
  static readonly tjpId = "chargeset";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ChargeSetListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const item of val) {
        out.push(item.to_s(),);
      }
    }
    return out.join(", ",);
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ChargeSetListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const item of val) {
        out.push(item.to_s(),);
      }
    }
    return `${this.tjpId} ${out.join(", ",)}`;
  }
}
