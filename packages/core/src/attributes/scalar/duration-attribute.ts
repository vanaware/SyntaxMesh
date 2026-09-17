/**
 * Atributo escalar duração.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DurationAttribute
 */

import { type PropertyLike } from "../../model/property-like.ts";
import { type AttributeContainer } from "../attribute-container.ts";
import { type AttributeDefinition } from "../attribute-definition.ts";
import { AttributeBase } from "../attribute-base.ts";

/**
 * Atributo escalar duração.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DurationAttribute
 */
export class DurationAttribute extends AttributeBase<number> {
  /**
   * ID do tipo de atributo para DurationAttribute.
   */
  static readonly tjpId = "duration";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DurationAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    if (val !== null) {
      // TODO Fase 11: usar query.scaleDuration(query.project.slotsToDays(val)) quando disponível
      return val.toString();
    }
    return "";
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DurationAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    return `${this.type.id} ${val}h`;
  }
}