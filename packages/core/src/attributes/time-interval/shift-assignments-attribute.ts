/**
 * Shift assignment attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ShiftAssignmentsAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

interface ShiftAssignment {
  shiftScenario: { property: { fullId: string } };
  interval: string;
}

interface ShiftAssignmentsValue {
  assignments: ShiftAssignment[];
}

/**
 * Shift assignment attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ShiftAssignmentsAttribute
 */
export class ShiftAssignmentsAttribute extends AttributeBase<unknown> {
  /**
   * Attribute type ID for ShiftAssignmentsAttribute.
   */
  static readonly tjpId = "shifts";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ShiftAssignmentsAttribute#to_s
   */
  override to_s(): string {
    const v = this.get() as ShiftAssignmentsValue | null;
    if (!v || !v.assignments || v.assignments.length === 0) {
      return "";
    }
    const sa = v.assignments[0];
    if (!sa) {
      return "";
    }
    return `${sa.shiftScenario.property.fullId} ${sa.interval}`;
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ShiftAssignmentsAttribute#to_tjp
   */
  override to_tjp(): string {
    const v = this.get() as ShiftAssignmentsValue | null;
    if (!v || !v.assignments || v.assignments.length === 0) {
      return `${this.tjpId} `;
    }
    let first = true;
    let str = `${this.tjpId} `;
    for (const sa of v.assignments) {
      if (!sa) {
        continue;
      }
      if (first) {
        first = false;
      } else {
        str += ",\n";
      }
      str += `${sa.shiftScenario.property.fullId} ${sa.interval}`;
    }
    return str;
  }
}
