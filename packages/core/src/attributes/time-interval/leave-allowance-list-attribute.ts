/**
 * Atributo de lista de permissões de licença.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LeaveAllowanceListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type LeaveAllowance, LeaveAllowanceList, } from "../../model/leave.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de permissões de licença.
 *
 * O Ruby não sobrescreve `to_tjp` nem `to_s`: cai em
 * `AttributeBase#to_tjp` + `Array#to_s`, que devolve o `inspect` da struct —
 * inútil como TJP. Aqui o attr usa {@link LeaveAllowanceList#to_tjp}
 * (uma provisão por linha), que é re-parseável pela gramática
 * `leaveallowance`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LeaveAllowanceListAttribute
 */
export class LeaveAllowanceListAttribute
  extends ListAttributeBase<LeaveAllowance> {
  /**
   * ID do tipo de atributo para LeaveAllowanceListAttribute.
   */
  static readonly tjpId = "leaveallowance";

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LeaveAllowanceListAttribute
   */
  override to_tjp(): string {
    const val = this.get();
    const list = new LeaveAllowanceList();
    if (val) list.push(...val,);
    return `${this.tjpId} ${list.to_tjp()}`;
  }
}
