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
    return String(this.get(),);
  }

  /**
   * Ruby `LogicalExpressionAttribute` não sobrepõe `to_tjp`; herda
   * `AttributeBase#to_tjp` = `@type.id + " " + get.to_s` (AttributeBase.rb:169).
   * Como `to_s` já é `get.to_s`, o despejo TJP é o id do tipo seguido do
   * dump da expressão (ex.: `logicalexpressions <op>`).
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.to_s()}`;
  }
}
