/**
 * Atributo de horas de trabalho.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:WorkingHoursAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

interface WorkingHoursValue {
  getWorkingHours: ((day: number,) => [number, number,][]) | undefined;
}

/**
 * Atributo de horas de trabalho.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:WorkingHoursAttribute
 */
export class WorkingHoursAttribute extends AttributeBase<unknown> {
  /**
   * ID do tipo de atributo para WorkingHoursAttribute.
   */
  static readonly tjpId = "workinghours";

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:WorkingHoursAttribute#to_tjp
   */
  override to_tjp(): string {
    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat",];
    let str = "";
    for (let day = 0; day < 7; day++) {
      str += `workinghours ${dayNames[day]} `;
      const whs =
        (this.get() as WorkingHoursValue | null)?.getWorkingHours?.(day,) ?? [];
      if (whs.length === 0) {
        str += "off";
        if (day < 6) str += "\n";
        continue;
      }
      let first = true;
      for (const iv of whs) {
        if (first) {
          first = false;
        } else {
          str += ", ";
        }
        const startH = Math.floor(iv[0] / 3600,);
        const startM = Math.floor((iv[0] % 3600) / 60,);
        const endH = Math.floor(iv[1] / 3600,);
        const endM = Math.floor((iv[1] % 3600) / 60,);
        str += `${startH}:${startM === 0 ? "00" : startM} - ${endH}:${
          endM === 0 ? "00" : endM
        }`;
      }
      if (day < 6) str += "\n";
    }
    return str;
  }
}
