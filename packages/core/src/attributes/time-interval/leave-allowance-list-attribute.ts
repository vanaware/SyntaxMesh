/**
 * Leave allowance list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LeaveAllowanceListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type LeaveAllowance, LeaveAllowanceList, } from "../../model/leave.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Leave allowance list attribute.
 *
 * Ruby does not override `to_tjp` nor `to_s`: it falls back to
 * `AttributeBase#to_tjp` + `Array#to_s`, which returns the struct `inspect` —
 * useless as TJP. Here the attribute uses {@link LeaveAllowanceList#to_tjp}
 * (one allowance per line), which is re-parseable by the `leaveallowance`
 * grammar.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LeaveAllowanceListAttribute
 */
export class LeaveAllowanceListAttribute
  extends ListAttributeBase<LeaveAllowance> {
  /**
   * Attribute type ID for LeaveAllowanceListAttribute.
   */
  static readonly tjpId = "leaveallowance";

  /**
   * Converts the value to TJP (TaskJuggler format).
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
