/**
 * Atributo de lista de colunas.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ColumnListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de colunas.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ColumnListAttribute
 */
export class ColumnListAttribute extends ListAttributeBase<string> {
  /**
   * ID do tipo de atributo para ColumnListAttribute.
   */
  static readonly tjpId = "columns";

  /**
   * Converte o valor para string.
   *
   * Fiel ao Ruby: `ColumnListAttribute#to_s` retorna literalmente a
   * string "TODO" no upstream (Attributes.rb:196-198 — nunca implementado
   * lá; as colunas são despejadas via `to_tjp`, não por `to_s`). Não é um
   * gap nosso: mudar isto desviaria do comportamento de referência.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ColumnListAttribute#to_s
   */
  override to_s(): string {
    return "TODO";
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ColumnListAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.get()?.join(", ",) ?? ""}`;
  }
}
