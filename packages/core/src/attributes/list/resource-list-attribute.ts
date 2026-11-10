/**
 * Resource list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ResourceListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Resource list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ResourceListAttribute
 */
export class ResourceListAttribute extends ListAttributeBase<
  { id: string; name: string; project: unknown; fullId?: string }
> {
  /**
   * Attribute type ID for ResourceListAttribute.
   */
  static readonly tjpId = "resourcelist";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ResourceListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.map((item,) => item.fullId).join(", ",) : "";
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ResourceListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    const out = val ? val.map((item,) => item.fullId) : [];
    return `${this.type.id} ${out.join(", ",)}`;
  }
}
