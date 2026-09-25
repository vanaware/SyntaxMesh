/**
 * Atributo de lista de bookings.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BookingListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de bookings.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BookingListAttribute
 */
export class BookingListAttribute
  extends ListAttributeBase<{ to_s(): string }> {
  /**
   * ID do tipo de atributo para BookingListAttribute.
   */
  static readonly tjpId = "bookinglist";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BookingListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.map((item,) => item.to_s()).join(", ",) : "";
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:BookingListAttribute#to_tjp
   */
  override to_tjp(): string {
    throw new Error(
      "Golden case \"BookingListAttribute to_tjp lança\" should throw",
    );
  }
}
