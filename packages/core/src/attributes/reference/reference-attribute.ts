/**
 * Reference attribute (URL + optional label).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ReferenceAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";
import { RichText, } from "../../richtext/rich-text.ts";

/**
 * Reference attribute (URL + optional label).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ReferenceAttribute
 */
export class ReferenceAttribute
  extends AttributeBase<{ url: string; label?: string }> {
  /**
   * Attribute type ID for ReferenceAttribute.
   */
  static readonly tjpId = "reference";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ReferenceAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.url : "";
  }

  /**
   * Converts the value to an RTI (Rich Text Intermediate).
   *
   * Ruby: a RichText link `[url label]` (label optional); empty value →
   * `nil`. No function handlers (Ruby: default `RichText.new(...)`).
   * Consumed by the reports via `Query#to_rti` (14C.9).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ReferenceAttribute#to_rti
   */
  override to_rti(): unknown {
    const val = this.get();
    if (!val) return null;
    const label = val.label ?? val.url;
    return new RichText(`[${val.url} ${label}]`,)
      .generateIntermediateFormat();
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ReferenceAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    if (!val) return "";
    const urlPart = `"${val.url}"`;
    const labelPart = val.label ? ` { label "${val.label}" }` : "";
    return `${this.type.id} ${urlPart}${labelPart}`;
  }

  /**
   * Gets the URL of the value.
   */
  url(): string | null {
    const val = this.get();
    return val ? val.url : null;
  }

  /**
   * Gets the label of the value.
   */
  label(): string | null {
    const val = this.get();
    if (!val) return null;
    return val.label || null;
  }
}
