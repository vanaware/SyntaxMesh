/**
 * Atributo escalar data.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DateAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";
import { TjTime, } from "../../time/tj-time.ts";

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
   * Ruby: `v.to_s(query ? query.timeFormat : '%Y-%m-%d')`. O `to_s()` do
   * port não recebe `query` — a formatação por `query.timeFormat` já é
   * feita no pipeline do Query (`query.ts:345`, que chama
   * `TjTime#to_s(timeFormat)` diretamente). Aqui, no dump independente de
   * query, aplicamos o default do Ruby (`%Y-%m-%d`) quando o valor é um
   * `TjTime`; strings ISO já estocadas pelo parser são devolvidas verbatim.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DateAttribute#to_s
   */
  override to_s(): string {
    const val = this.get() as unknown;
    if (val instanceof TjTime) {
      return val.to_s("%Y-%m-%d",);
    }
    if (val) {
      return String(val,);
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
