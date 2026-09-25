/**
 * Atributo de lista de recursos.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ResourceListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";
import { NotYetImplementedError, } from "../errors.ts";

/**
 * Atributo de lista de recursos.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ResourceListAttribute
 */
export class ResourceListAttribute
  extends ListAttributeBase<{ id: string; name: string; project: unknown; fullId: string }> {
  /**
   * ID do tipo de atributo para ResourceListAttribute.
   */
  static readonly tjpId = "resourcelist";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ResourceListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.map((item,) => item.id).join(", ",) : "";
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ResourceListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    const out = val ? val.map((item,) => item.id) : [];
    return `${this.tjpId} ${out.join(", ",)}`;
  }

  /**
   * Converte o valor para RTI (Rich Text Intermediate).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ResourceListAttribute#to_rti
   */
  override to_rti(): unknown {
    // TODO(@djones) Fase 12: usar RichText quando disponível
    throw new NotYetImplementedError("12", "to_rti",);
  }
}
