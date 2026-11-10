/**
 * Rich text attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RichTextAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { AttributeBase, } from "../attribute-base.ts";
import { type RichTextIntermediate, } from "./rich-text-port.ts";

/**
 * Rich text attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RichTextAttribute
 */
export class RichTextAttribute extends AttributeBase<unknown> {
  /**
   * Attribute type ID for RichTextAttribute.
   */
  // `string` (not the literal) so that MarkdownAttribute can override it with
  // `override` (C5.3, ADR 039) without violating the class's static typing.
  static readonly tjpId: string = "richtext";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RichTextAttribute#to_s
   */
  override to_s(): string {
    const val = this.get() as RichTextIntermediate | null;
    return val ? val.to_s() : "";
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:RichTextAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get() as RichTextIntermediate | null;
    return `${this.type.id} ${
      this.quotedString(val?.richText.inputText ?? "",)
    }`;
  }
}
