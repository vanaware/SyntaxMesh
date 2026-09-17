/**
 * Atributo escalar booleano.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BooleanAttribute
 */

import { type PropertyLike } from "../../model/property-like.ts";
import { type AttributeContainer } from "../attribute-container.ts";
import { type AttributeDefinition } from "../attribute-definition.ts";
import { AttributeBase } from "../attribute-base.ts";

/**
 * Atributo escalar booleano.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BooleanAttribute
 */
export class BooleanAttribute extends AttributeBase<boolean> {
  /**
   * ID do tipo de atributo para BooleanAttribute.
   */
  static readonly tjpId = "boolean";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BooleanAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? "true" : "false";
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BooleanAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    return `${this.type.id} ${val ? "yes" : "no"}`;
  }
}