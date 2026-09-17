/**
 * Atributo de atribuições de turnos.
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
 * Atributo de atribuições de turnos.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ShiftAssignmentsAttribute
 */
export class ShiftAssignmentsAttribute extends AttributeBase<unknown> {
  /**
   * ID do tipo de atributo para ShiftAssignmentsAttribute.
   */
  static readonly tjpId = "shifts";

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ShiftAssignmentsAttribute#to_tjp
   */
  override to_tjp(): string {
    const v = this.get() as ShiftAssignmentsValue | null;
    if (!v || !v.assignments) {
      return "shifts ";
    }
    let first = true;
    let str = "shifts ";
    for (const sa of v.assignments) {
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
