/**
 * Atributo de lista de flags.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FlagListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de flags.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FlagListAttribute
 */
export class FlagListAttribute extends ListAttributeBase<string> {
  /**
   * ID do tipo de atributo para FlagListAttribute.
   */
  static readonly tjpId = "flaglist";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FlagListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.join(", ",) : "";
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:FlagListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    return `flags ${val ? val.join(", ",) : ""}`;
  }
}
