/**
 * Duration scalar attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DurationAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";
import { formatDuration, } from "./duration-formatter.ts";

/**
 * Duration scalar attribute.
 *
 * The value is a `Float` of hours in Ruby, so `to_s` (inherited from
 * `AttributeBase`) always carries the decimal part: `5.0`, `16.5`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DurationAttribute
 */
export class DurationAttribute extends AttributeBase<number> {
  /**
   * Attribute type ID for DurationAttribute.
   */
  static readonly tjpId = "duration";

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DurationAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    return `${this.tjpId} ${val !== null ? `${val}h` : ""}`;
  }
}
