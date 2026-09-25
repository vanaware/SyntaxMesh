/**
 * Atributo de lista de símbolos.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SymbolListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de símbolos.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SymbolListAttribute
 */
export class SymbolListAttribute extends ListAttributeBase<string> {
  /**
   * ID do tipo de atributo para SymbolListAttribute.
   */
  static readonly tjpId = "symbollist";

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SymbolListAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.get()?.join(", ") ?? ""}`;
  }
}
