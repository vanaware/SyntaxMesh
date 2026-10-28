/**
 * Atributo de lista de expressões lógicas.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LogicalExpressionListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
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

  // Ruby `LogicalExpressionListAttribute` não sobrepõe `to_tjp`; herda o
  // despejo de lista (id do tipo + valores). Deixamos `ListAttributeBase#to_tjp`
  // assumir: `logicalexpressions <v1, v2>`.
}
