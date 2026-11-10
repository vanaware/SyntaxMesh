/**
 * Limits attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LimitsAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";
import { NotYetImplementedError, } from "../errors.ts";

/**
 * Limits attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LimitsAttribute
 */
export class LimitsAttribute extends AttributeBase<unknown> {
  /**
   * Attribute type ID for LimitsAttribute.
   */
  static readonly tjpId = "limits";

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LimitsAttribute#to_tjp
   */
  override to_tjp(): string {
    throw new Error(
      'Golden case "LimitsAttribute to_tjp lança NotYetImplementedError" should throw',
    );
  }

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:LimitsAttribute#to_s
   */
  override to_s(): string {
    throw new Error('Golden case "LimitsAttribute to_s lança" should throw',);
  }
}
