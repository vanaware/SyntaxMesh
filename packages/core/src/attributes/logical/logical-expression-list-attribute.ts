/**
 * Atributo de lista de expressões lógicas.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LogicalExpressionListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { NotYetImplementedError, } from "../errors.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de expressões lógicas.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LogicalExpressionListAttribute
 */
export class LogicalExpressionListAttribute extends ListAttributeBase<unknown> {
  /**
   * ID do tipo de atributo para LogicalExpressionListAttribute.
   */
  static readonly tjpId = "logicalexpressions";

  override to_s(): string {
    const val = this.get();
    return val ? val.join(", ",) : "";
  }

  override to_tjp(): string {
    throw new NotYetImplementedError("11", "to_tjp",);
  }
}
