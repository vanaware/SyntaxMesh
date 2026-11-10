/**
 * Allocation list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AllocationAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Allocation selection modes.
 */
export const ALLOCATION_MODES = [
  "order",
  "lowprob",
  "lowload",
  "hiload",
  "random",
] as const;

/**
 * Allocation list attribute.
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
   * Attribute type ID for AllocationAttribute.
   */
  static readonly tjpId = "allocation";

  /**
   * Converts the value to a string.
   *
   * Faithful port of `AllocationAttribute#to_s` (Attributes.rb:78-103): each
   * allocation becomes `[ c1, c2 ] select by <mode> [mandatory ] [persistent ]`,
   * and multiple allocations are joined by a newline. `ALLOCATION_MODES`
   * mirrors the Ruby modes array (order = index of `selectionMode`).
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
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:AllocationAttribute#to_tjp
   */
  override to_tjp(): string {
    return this.tjpId;
  }
}
