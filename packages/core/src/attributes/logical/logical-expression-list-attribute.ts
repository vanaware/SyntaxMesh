/**
 * Logical expression list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LogicalExpressionListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Logical expression list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LogicalExpressionListAttribute
 */
export class LogicalExpressionListAttribute extends ListAttributeBase<unknown> {
  /**
   * Attribute type id for LogicalExpressionListAttribute.
   */
  static readonly tjpId = "logicalexpressions";

  /**
   * Converts the stored list of expressions to text.
   *
   * @returns The expressions joined by `, `, or an empty string when unset.
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.join(", ",) : "";
  }

  // Ruby `LogicalExpressionListAttribute` does not override `to_tjp`; it
  // inherits the list dump (type id + values). We let `ListAttributeBase#to_tjp`
  // take over: `logicalexpressions <v1, v2>`.
}
