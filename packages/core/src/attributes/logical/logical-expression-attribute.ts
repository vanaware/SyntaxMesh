/**
 * Logical expression attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LogicalExpressionAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";

/**
 * Logical expression attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LogicalExpressionAttribute
 */
export class LogicalExpressionAttribute extends AttributeBase<unknown> {
  /**
   * Attribute type id for LogicalExpressionAttribute.
   */
  static readonly tjpId = "logicalexpressions";

  /**
   * Converts the stored expression to text.
   *
   * @returns The expression rendered with `String()`.
   */
  override to_s(): string {
    return String(this.get(),);
  }

  /**
   * Ruby `LogicalExpressionAttribute` does not override `to_tjp`; it inherits
   * `AttributeBase#to_tjp` = `@type.id + " " + get.to_s`
   * (AttributeBase.rb:169). Since `to_s` already is `get.to_s`, the TJP dump is
   * the type id followed by the expression dump (e.g. `logicalexpressions
   * <op>`).
   *
   * @returns The expression serialized as TJP.
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.to_s()}`;
  }
}
