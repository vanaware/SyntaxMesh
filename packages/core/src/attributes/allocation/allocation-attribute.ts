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
    const val = this.get();
    const out = [];
    if (val) {
      let first = true;
      for (const allocation of val) {
        if (first) {
          first = false;
        } else {
          out.push("\n",);
        }
        out.push("[ ",);
        let firstR = true;
        for (const resource of allocation.candidates) {
          if (firstR) {
            firstR = false;
          } else {
            out.push(", ",);
          }
          out.push(resource.fullId,);
        }
        const mode = ALLOCATION_MODES[allocation.selectionMode] ?? "order";
        out.push(` ] select by ${mode} `,);
        if (allocation.mandatory) {
          out.push("mandatory ",);
        }
        if (allocation.persistent) {
          out.push("persistent ",);
        }
      }
    }
    return out.join("",);
  }
}
