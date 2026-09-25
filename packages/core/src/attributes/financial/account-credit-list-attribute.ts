/**
 * Atributo de lista de créditos de conta.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountCreditListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de créditos de conta.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountCreditListAttribute
 */
export class AccountCreditListAttribute extends ListAttributeBase<{ amount: number }> {
  /**
   * ID do tipo de atributo para AccountCreditListAttribute.
   */
  static readonly tjpId = "credits";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountCreditListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const item of val) {
        out.push(item.amount.toString(),);
      }
    }
    return out.join(", ",);
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountCreditListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const item of val) {
        out.push(item.amount.toString(),);
      }
    }
    return `${this.tjpId} ${out.join(", ",)}`;
  }
}
