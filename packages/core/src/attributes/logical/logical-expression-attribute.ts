/**
 * Atributo de expressão lógica.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LogicalExpressionAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Atributo de expressão lógica.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LogicalExpressionAttribute
 */
export class LogicalExpressionAttribute extends AttributeBase<unknown> {
  /**
   * ID do tipo de atributo para LogicalExpressionAttribute.
   */
  static readonly tjpId = "logicalexpressions";

  override to_s(): string {
    return "TODO";
  }

  override to_tjp(): string {
    throw new Error(
      "Golden case \"LogicalExpressionAttribute to_tjp lança\" should throw",
    );
  }
}
