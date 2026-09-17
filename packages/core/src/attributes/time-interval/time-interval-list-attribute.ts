/**
 * Atributo de lista de intervalos de tempo.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TimeIntervalListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de intervalos de tempo.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TimeIntervalListAttribute
 */
export class TimeIntervalListAttribute
  extends ListAttributeBase<{ to_s(): string }> {
  /**
   * ID do tipo de atributo para TimeIntervalListAttribute.
   */
  static readonly tjpId = "intervallist";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TimeIntervalListAttribute#to_s
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
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TimeIntervalListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const item of val) {
        out.push(item.to_s(),);
      }
    }
    return `${this.type.id} ${out.join(", ",)}`;
  }
}
