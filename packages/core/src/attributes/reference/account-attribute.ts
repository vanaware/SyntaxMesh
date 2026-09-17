/**
 * Atributo de referência à conta.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Atributo de referência à conta.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountAttribute
 */
export class AccountAttribute extends AttributeBase<{ id: string }> {
  /**
   * ID do tipo de atributo para AccountAttribute.
   */
  static readonly tjpId = "account";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.id : "";
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AccountAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    return val ? val.id : "";
  }
}
