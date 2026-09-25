/**
 * Atributo de lista de permissões de licença.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LeaveAllowanceListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de permissões de licença.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LeaveAllowanceListAttribute
 */
export class LeaveAllowanceListAttribute extends ListAttributeBase<unknown> {
  /**
   * ID do tipo de atributo para LeaveAllowanceListAttribute.
   */
  static readonly tjpId = "leaveallowance";

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LeaveAllowanceListAttribute#to_tjp
   */
  override to_tjp(): string {
    throw new Error(
      'Golden case "LeaveAllowanceListAttribute to_tjp lança" should throw',
    );
  }
}
