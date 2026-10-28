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
   * Port fiel de `AllocationAttribute#to_s` (Attributes.rb:78-103): cada
   * alocação vira `[ c1, c2 ] select by <modo> [mandatory ] [persistent ]`,
   * e várias alocações são unidas por quebra de linha. `ALLOCATION_MODES`
   * espelha o array de modos do Ruby (ordem = índice de `selectionMode`).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AllocationAttribute#to_s
   */
  override to_s(): string {
    const allocations = this.get();
    if (!allocations) {
      return "";
    }
    const parts: string[] = [];
    for (const allocation of allocations) {
      const candidates = allocation.candidates
        .map((resource,) => resource.fullId)
        .join(", ",);
      const mode = ALLOCATION_MODES[allocation.selectionMode] ?? "";
      let line = `[ ${candidates} ] select by ${mode} `;
      if (allocation.mandatory) {
        line += "mandatory ";
      }
      if (allocation.persistent) {
        line += "persistent ";
      }
      parts.push(line,);
    }
    return parts.join("\n",);
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
