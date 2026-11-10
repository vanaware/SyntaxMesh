/**
 * Date scalar attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DateAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";
import { TjTime, } from "../../time/tj-time.ts";

/**
 * Date scalar attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DateAttribute
 */
export class DateAttribute extends AttributeBase<string> {
  /**
   * Attribute type ID for DateAttribute.
   */
  static readonly tjpId = "date";

  /**
   * Converts the value to a string.
   *
   * Ruby: `v.to_s(query ? query.timeFormat : '%Y-%m-%d')`. The port's `to_s()`
   * does not receive `query` — the `query.timeFormat` formatting already
   * happens in the Query pipeline (`query.ts:345`, which calls
   * `TjTime#to_s(timeFormat)` directly). Here, in the dump independent of the
   * query, we apply the Ruby default (`%Y-%m-%d`) when the value is a
   * `TjTime`; ISO strings already stored by the parser are returned verbatim.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DateAttribute#to_s
   */
  override to_s(): string {
    const val = this.get() as unknown;
    if (val instanceof TjTime) {
      return val.to_s("%Y-%m-%d",);
    }
    if (val) {
      return String(val,);
    }
    return "Error";
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DateAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.get()}`;
  }
}
