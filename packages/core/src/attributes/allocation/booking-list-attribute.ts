/**
 * Booking list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BookingListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Booking list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BookingListAttribute
 */
export class BookingListAttribute
  extends ListAttributeBase<{ to_s(): string }> {
  /**
   * Attribute type ID for BookingListAttribute.
   */
  static readonly tjpId = "bookinglist";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BookingListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    if (val === null) return "";
    return val.map((item,) => item.to_s()).join(", ",);
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BookingListAttribute#to_tjp
   */
  override to_tjp(): string {
    throw new Error(
      'Golden case "BookingListAttribute to_tjp lança" should throw',
    );
  }
}
