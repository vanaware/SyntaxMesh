/**
 * Atributo escalar data.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DateAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Atributo escalar data.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DateAttribute
 */
export class DateAttribute extends AttributeBase<string> {
  /**
   * ID do tipo de atributo para DateAttribute.
   */
  static readonly tjpId = "date";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DateAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    if (val) {
      // TODO(@djones) Fase 11: usar query.timeFormat quando disponível
      return val;
    }
    return "Error";
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DateAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.get()}`;
  }
}
