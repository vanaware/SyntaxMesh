/**
 * Atributo de lista de alocações.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AllocationAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Modos de seleção de alocação.
 */
export const ALLOCATION_MODES = [
  "order",
  "lowprob",
  "lowload",
  "hiload",
  "random",
] as const;

/**
 * Atributo de lista de alocações.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AllocationAttribute
 */
export class AllocationAttribute extends ListAttributeBase<{
  candidates: { fullId: string }[];
  selectionMode: number;
  mandatory: boolean;
  persistent: boolean;
}> {
  /**
   * ID do tipo de atributo para AllocationAttribute.
   */
  static readonly tjpId = "allocation";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AllocationAttribute#to_s
   */
  override to_s(): string {
    return "TODO";
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AllocationAttribute#to_tjp
   */
  override to_tjp(): string {
    return this.tjpId;
  }
}
