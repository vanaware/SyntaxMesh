/**
 * Scenario list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ScenarioListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Scenario list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ScenarioListAttribute
 */
export class ScenarioListAttribute extends ListAttributeBase<string> {
  /**
   * Attribute type ID for ScenarioListAttribute.
   */
  static readonly tjpId = "scenarios";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ScenarioListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.join(", ",) : "";
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ScenarioListAttribute#to_tjp
   */
  override to_tjp(): string {
    return `${this.tjpId} ${this.get()?.join(", ",) ?? ""}`;
  }
}
